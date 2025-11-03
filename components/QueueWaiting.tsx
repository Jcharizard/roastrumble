'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface QueueWaitingProps {
  nickname: string
  onMatchFound: (roomId: string, socket: Socket) => void
  onCancel: () => void
}

export default function QueueWaiting({ nickname, onMatchFound, onCancel }: QueueWaitingProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [waitTime, setWaitTime] = useState(0)
  const [usersOnline, setUsersOnline] = useState(0)
  const [queueSize, setQueueSize] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const hasInitialized = useRef(false)
  const matchFoundRef = useRef(false) // Track if match was found
  const connectionId = useRef(`conn_${Date.now()}_${Math.random()}`)

  useEffect(() => {
    // Use sessionStorage to prevent React Strict Mode duplicate connections
    const storageKey = `roastrumble_connection_${nickname}`
    const existingConnection = sessionStorage.getItem(storageKey)
    
    if (existingConnection && Date.now() - parseInt(existingConnection) < 3000) {
      console.log('⚠️ Recent connection detected, skipping to prevent duplicate...')
      hasInitialized.current = true
      return
    }
    
    // Prevent multiple connections - only run once per mount
    if (hasInitialized.current) {
      console.log('Already connected, skipping...')
      return
    }

    console.log('Creating socket connection...')
    hasInitialized.current = true
    sessionStorage.setItem(storageKey, Date.now().toString())

    // Connect to signaling server
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001'
    const newSocket = io(serverUrl, {
      forceNew: true, // Force new connection
      transports: ['websocket'], // Use only websocket
      autoConnect: true,
      reconnection: false, // Disable auto-reconnection to prevent duplicates
      timeout: 20000, // 20 second timeout
      reconnectionAttempts: 0, // No reconnection attempts
      multiplex: false // Disable multiplexing to prevent connection reuse
    })
    socketRef.current = newSocket

    newSocket.on('connect', () => {
      console.log('Connected to server')
      // Join queue immediately - the server will handle duplicates
      console.log('Joining queue with nickname:', nickname)
      newSocket.emit('join-queue', { nickname })
    })

    newSocket.on('match-found', ({ roomId, opponent }) => {
      console.log('✅ Match found!', roomId, opponent)
      matchFoundRef.current = true // Mark that match was found
      // Don't disconnect - pass socket to BattleRoom
      onMatchFound(roomId, newSocket)
    })

    newSocket.on('queue-update', ({ queueSize, usersOnline }) => {
      setQueueSize(queueSize)
      setUsersOnline(usersOnline)
    })

    setSocket(newSocket)

    // Wait time counter
    const interval = setInterval(() => {
      setWaitTime((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(interval)
      // CRITICAL: Only disconnect if match was NOT found
      // If match was found, BattleRoom needs the socket!
      if (!matchFoundRef.current && newSocket && newSocket.connected) {
        console.log('🧹 QueueWaiting cleanup: No match found, disconnecting socket')
        newSocket.emit('leave-queue')
        newSocket.disconnect()
      } else if (matchFoundRef.current) {
        console.log('✅ QueueWaiting cleanup: Match found, keeping socket alive for BattleRoom')
      }
      hasInitialized.current = false
      socketRef.current = null
      // Clear storage key after a delay
      setTimeout(() => {
        sessionStorage.removeItem(storageKey)
      }, 3000)
    }
  }, [nickname]) // Include nickname in deps

  const handleCancel = () => {
    if (socket) {
      socket.emit('leave-queue')
      socket.disconnect()
    }
    onCancel()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-roast-dark to-black">
      <div className="text-center animate-slide-up">
        {/* Animated Logo */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto bg-roast-red rounded-full flex items-center justify-center animate-pulse-subtle">
            <div className="text-5xl">🔍</div>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-roast-cream mb-4">
          Finding Your Opponent...
        </h2>
        
        <p className="text-xl text-roast-cream/70 mb-8">
          Searching for someone to battle
        </p>

        {/* Stats */}
        <div className="mb-8 flex gap-4">
          <div className="p-4 bg-roast-dark/50 rounded-lg border border-roast-red/30">
            <p className="text-roast-cream/60 text-sm">Waiting</p>
            <p className="text-roast-red font-bold text-2xl">{waitTime}s</p>
          </div>
          <div className="p-4 bg-roast-dark/50 rounded-lg border border-roast-red/30">
            <p className="text-roast-cream/60 text-sm">Users Online</p>
            <p className="text-roast-red font-bold text-2xl">{usersOnline}</p>
          </div>
          <div className="p-4 bg-roast-dark/50 rounded-lg border border-roast-red/30">
            <p className="text-roast-cream/60 text-sm">In Queue</p>
            <p className="text-roast-red font-bold text-2xl">{queueSize}</p>
          </div>
        </div>

        {/* User info */}
        <div className="mb-8 p-6 bg-roast-dark/50 rounded-lg border border-roast-red/30 max-w-md">
          <p className="text-roast-cream/60 mb-2">Your nickname:</p>
          <p className="text-2xl font-bold text-roast-cream">{nickname}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleCancel}
            className="bg-transparent hover:bg-roast-dark border-2 border-roast-red/50 hover:border-roast-red text-roast-cream font-bold px-8 py-3 rounded-lg transition-all"
          >
            Cancel Search
          </button>
          
          {waitTime > 10 && queueSize === 0 && (
            <button
              onClick={() => alert('Practice mode coming soon! For now, share the site with friends to get matches.')}
              className="bg-roast-red/20 hover:bg-roast-red/30 border-2 border-roast-red text-roast-cream font-bold px-8 py-3 rounded-lg transition-all"
            >
              🎯 Practice Mode
            </button>
          )}
        </div>

        {/* Tips / No users message */}
        <div className="mt-12 max-w-md space-y-3">
          {usersOnline === 1 && waitTime > 5 && (
            <div className="p-4 bg-roast-red/10 rounded-lg border border-roast-red/40">
              <p className="text-roast-cream font-bold mb-2">😔 No one else is online right now</p>
              <p className="text-roast-cream/70 text-sm">
                Share the site with friends or come back later when more people are online!
              </p>
            </div>
          )}
          
          <div className="p-3 bg-roast-dark/30 rounded-lg border border-roast-red/20">
            <p className="text-roast-cream/50 text-sm">
              💡 While you wait: Think of some killer opening lines!
            </p>
          </div>
          <div className="p-3 bg-roast-dark/30 rounded-lg border border-roast-red/20">
            <p className="text-roast-cream/50 text-sm">
              🎤 Pro tip: Speak clearly and keep the energy high
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

