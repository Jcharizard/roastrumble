'use client'

import { useEffect, useState, useRef } from 'react'
import { Socket } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import DOMPurify from 'isomorphic-dompurify'

interface BattleRoomProps {
  nickname: string
  roomId: string
  socket: Socket
  onLeave: () => void
}

type BattleMode = 'waiting' | 'player1' | 'player2' | 'ended' | 'countdown'

export default function BattleRoom({ nickname, roomId, socket, onLeave }: BattleRoomProps) {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null)
  const [opponentName, setOpponentName] = useState('???')
  const [battleMode, setBattleMode] = useState<BattleMode>('waiting')
  const [timeLeft, setTimeLeft] = useState(90) // 1:30 default
  const [countdown, setCountdown] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [battleWords, setBattleWords] = useState<string[]>([])
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [beatVolume, setBeatVolume] = useState(0.5) // 50% default
  const [voiceVolume, setVoiceVolume] = useState(1.0) // 100% default
  const [opponentVolume, setOpponentVolume] = useState(1.0) // 100% default (renamed from masterVolume)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, user: string, message: string, timestamp: number}>>([])
  const [newMessage, setNewMessage] = useState('')
  const [hasMicPrivilege, setHasMicPrivilege] = useState(false)
  const [nextHasMic, setNextHasMic] = useState(false) // Track who's up next during countdown
  const hasMicPrivilegeRef = useRef(false) // Track current mic privilege for countdown
  const [audioTimer, setAudioTimer] = useState(360) // 6 minutes in seconds
  const [selectedBeat, setSelectedBeat] = useState<string | null>(null)
  const [showBeatSelection, setShowBeatSelection] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState(30) // 30 second redirect
  const redirectIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [hasVotedNewWords, setHasVotedNewWords] = useState(false) // Track if I voted for new words
  const [opponentVotedNewWords, setOpponentVotedNewWords] = useState(false) // Track if opponent voted
  const [wordsChangedCount, setWordsChangedCount] = useState(0) // Track how many times words have been changed (max 2)
  const [voteLocked, setVoteLocked] = useState(false) // Prevent multiple votes in same round

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const peerRef = useRef<SimplePeer.Instance | null>(null)
  const signalQueueRef = useRef<any[]>([]) // Queue for signals received before peer is ready
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!socket) return

    console.log('BattleRoom: Using existing socket connection')
    console.log('BattleRoom: Joining room', roomId)
    socket.emit('join-room', { roomId, nickname })

    const handleBattleStart = ({ opponent, words, isInitiator, firstPlayer, hasMicPrivilege: serverMicPrivilege, selectedBeat }: {
      opponent: string
      words: string[]
      isInitiator: boolean
      firstPlayer: string
      hasMicPrivilege: boolean
      selectedBeat: string
    }) => {
      console.log('Battle starting!', { opponent, words, isInitiator, firstPlayer, serverMicPrivilege, selectedBeat })
      setOpponentName(opponent)
      setBattleWords(words)
      
      // Set up WebRTC
      setupWebRTC(isInitiator, socket)
      
      // Use server-side mic privilege
      const iAmFirst = serverMicPrivilege
      
      // Show beat selection first
      setTimeout(() => {
        setShowBeatSelection(true)
        // Show server-selected beat
        setSelectedBeat(selectedBeat)
        
         // After 5 seconds, hide beat selection and show countdown
         setTimeout(() => {
           setShowBeatSelection(false)
           setBattleMode('countdown') // Set to countdown mode
           setNextHasMic(iAmFirst) // For INITIAL countdown: show who's starting
           isInitialCountdownRef.current = true // Mark as initial countdown
           setCountdown(5)
           let currentCount = 5
           // Clear any existing countdown interval
           if (countdownIntervalRef.current) {
             clearInterval(countdownIntervalRef.current)
             countdownIntervalRef.current = null
           }
           
           countdownIntervalRef.current = setInterval(() => {
             currentCount -= 1
             setCountdown(currentCount)
             
             // Send heartbeat to keep connection alive (especially for mobile browsers)
             socket.emit('heartbeat', { roomId })
             
             if (currentCount <= 0) {
               clearInterval(countdownIntervalRef.current!)
               countdownIntervalRef.current = null
               setCountdown(0) // Reset countdown
               
               // COUNT INITIAL COUNTDOWN AS SWITCH 1/4
               globalTurnCountRef.current = 1
               console.log('📊 Initial countdown complete - counted as Switch 1/4')
               
               // Set initial battle mode and mic privilege
               setBattleMode(iAmFirst ? 'player1' : 'player2')
               setHasMicPrivilege(iAmFirst)
               hasMicPrivilegeRef.current = iAmFirst // Update ref
               isInitialCountdownRef.current = false // Next countdown is a switch
               
               // NOW enable mic for first player (AFTER countdown, not during)
               if (localStreamRef.current) {
                 const audioTrack = localStreamRef.current.getAudioTracks()[0]
                 if (audioTrack) {
                   if (iAmFirst) {
                     audioTrack.enabled = true
                     setIsMuted(false)
                     console.log('🎤 Initial: YOU START - MIC ENABLED AFTER COUNTDOWN')
                   } else {
                     audioTrack.enabled = false
                     setIsMuted(true)
                     console.log('🔇 Initial: OPPONENT STARTS - YOU ARE MUTED')
                   }
                 }
               }
               
               // START BOTH TIMERS TOGETHER (no delay for sync)
               startTimer(90) // 1:30 per round
               startAudioTimer() // Start 6-minute audio timer
               
              // Start beat audio with iOS Safari support
              if (audioRef.current) {
                console.log('🎵 Playing audio:', selectedBeat ? `/audio/${selectedBeat}.mp3` : "/audio/hmm-freestyle-beat.mp3")
                // Update audio source if needed
                const newSrc = selectedBeat ? `/audio/${selectedBeat}.mp3` : "/audio/hmm-freestyle-beat.mp3"
                if (audioRef.current.src !== window.location.origin + newSrc) {
                  audioRef.current.src = newSrc
                  audioRef.current.load()
                }
                
                // Attempt to play with error handling for iOS
                const playPromise = audioRef.current.play()
                if (playPromise !== undefined) {
                  playPromise.then(() => {
                    console.log('✅ Beat audio playing successfully')
                    setIsAudioPlaying(true)
                  }).catch((error) => {
                    console.warn('⚠️ Audio autoplay blocked (iOS/Safari):', error)
                    console.log('🔊 User must interact with page to start audio')
                    setIsAudioPlaying(false)
                    // Show alert to prompt user interaction
                    setTimeout(() => {
                      if (!audioRef.current?.paused) return // Already playing
                      alert('🎵 Tap OK to start the beat! (Required for iOS)')
                      audioRef.current?.play().then(() => {
                        console.log('✅ Beat started after user interaction')
                        setIsAudioPlaying(true)
                      }).catch(e => console.error('❌ Still cannot play audio:', e))
                    }, 500)
                  })
                }
              }
             }
           }, 1000)
         }, 5000) // 5 second beat selection
      }, 3000) // 3 second initial wait
    }

    const handleWebRTCSignal = (signal: SimplePeer.SignalData) => {
      console.log('📡 Received WebRTC signal from opponent', signal.type || 'candidate')
      
      if (!peerRef.current) {
        console.warn('⚠️ Peer not created yet, queuing signal')
        signalQueueRef.current.push(signal)
        return
      }
      
      if (peerRef.current.destroyed) {
        console.error('❌ Peer already destroyed, cannot signal')
        return
      }
      
      // Try to signal the peer
      try {
        peerRef.current.signal(signal)
        console.log('✅ Signal processed successfully')
      } catch (error) {
        console.error('❌ Error signaling peer:', error)
        // Queue if signaling failed
        signalQueueRef.current.push(signal)
      }
    }

    socket.on('battle-start', handleBattleStart)
    socket.on('webrtc-signal', handleWebRTCSignal)
    socket.on('chat-message', (message) => {
      // Add unique ID to prevent duplication
      const messageWithId = {
        ...message,
        id: `${message.user}-${Date.now()}-${Math.random()}`,
        timestamp: Date.now()
      }
      setChatMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => 
          msg.user === message.user && 
          msg.message === message.message && 
          Math.abs(msg.timestamp - messageWithId.timestamp) < 1000
        )
        if (exists) {
          console.log('Duplicate chat message detected, ignoring')
          return prev
        }
        return [...prev, messageWithId]
      })
    })
    socket.on('force-mute', () => {
      setHasMicPrivilege(false)
      setIsMuted(true)
    })
    socket.on('opponent-left', () => {
      alert('Opponent disconnected! Returning to home...')
      onLeave()
    })
    socket.on('opponent-skipped', () => {
      alert("Opponent skipped! Guess they couldn't handle the heat 🔥")
      onLeave()
    })
    socket.on('new-words-vote-update', ({ votes, opponentVoted }) => {
      console.log('📊 New words vote update:', { votes, opponentVoted })
      setOpponentVotedNewWords(opponentVoted)
    })
    socket.on('new-words-generated', ({ words }) => {
      console.log('🔄 New battle words received:', words)
      setBattleWords(words)
      // Reset voting state for next potential vote
      setHasVotedNewWords(false)
      setOpponentVotedNewWords(false)
      // Increment words changed count
      setWordsChangedCount(prev => prev + 1)
      console.log(`📊 Words changed ${wordsChangedCount + 1}/2 times`)
    })
    socket.on('start-countdown', () => {
      console.log('🔄 Opponent initiated countdown - I\'m GAINING mic!')
      
      // Opponent has mic and is losing it, so I'm GAINING it
      const willGetMicNext = true
      nextMicStateRef.current = willGetMicNext
      setNextHasMic(willGetMicNext)
      
      // Clear any existing countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      
      // Pause audio timer during countdown
      pauseAudioTimer()
      
      // Enter countdown mode
      setBattleMode('countdown')
      setCountdown(5)
      let currentCount = 5
      countdownIntervalRef.current = setInterval(() => {
        currentCount -= 1
        setCountdown(currentCount)
        
        // Send heartbeat to keep connection alive (especially for mobile browsers)
        socket.emit('heartbeat', { roomId })
        
        if (currentCount <= 0) {
          clearInterval(countdownIntervalRef.current!)
          countdownIntervalRef.current = null
          setCountdown(0)
          
          console.log('⏰ Countdown finished (I was receiving mic)')
          
          // Increment GLOBAL turn count (both clients do this)
          globalTurnCountRef.current += 1
          console.log(`📊 Switch ${globalTurnCountRef.current}/4 complete`)
          
          // Unlock voting for the new round
          setVoteLocked(false)
          console.log('🔓 Vote unlocked for new round')
          
          // Check if battle should end (4 switches total = initial + 3 more)
          if (globalTurnCountRef.current >= 4) {
            console.log('🏁 4 switches completed - ending battle!')
            setBattleMode('ended')
            if (audioTimerRef.current) clearInterval(audioTimerRef.current)
            if (battleTimerRef.current) clearInterval(battleTimerRef.current)
            return
          }
          
          // Transition to battle mode based on who has mic privilege
          setBattleMode(hasMicPrivilegeRef.current ? 'player1' : 'player2')
          startTimer(90) // Start the 1:30 timer
          resumeAudioTimer() // Resume audio timer
          nextMicStateRef.current = null // Reset for next switch
          console.log('✅ Battle resumed - I now have mic!')
        }
      }, 1000)
    })
    socket.on('mic-privilege-updated', ({ hasPrivilege }) => {
      console.log('🔄 Mic privilege updated from server')
      console.log('🔄 My nickname:', nickname)
      console.log('🔄 New hasPrivilege:', hasPrivilege)
      
      setHasMicPrivilege(hasPrivilege)
      hasMicPrivilegeRef.current = hasPrivilege // Update ref for future switches
      
      // Handle mic privilege changes - control audio track
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0]
        if (audioTrack) {
          if (hasPrivilege) {
            // Gaining mic privilege - unmute and allow speaking
            audioTrack.enabled = true
            setIsMuted(false)
            console.log('🎤 Mic privilege gained - YOU CAN NOW SPEAK')
          } else {
            // Losing mic privilege - force mute so opponent can speak
            audioTrack.enabled = false
            setIsMuted(true)
            console.log('🔇 Mic privilege lost - YOU MUST LISTEN')
          }
        }
      }
      
      console.log('✅ Mic privilege updated:', hasPrivilege)
    })

    return () => {
      console.log('BattleRoom: Cleaning up...')
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (peerRef.current) {
        peerRef.current.destroy()
      }
      // Clean up all timers
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current)
        audioTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (battleTimerRef.current) {
        clearInterval(battleTimerRef.current)
        battleTimerRef.current = null
      }
      // Clean up event listeners
      socket.off('battle-start', handleBattleStart)
      socket.off('webrtc-signal', handleWebRTCSignal)
      socket.off('chat-message')
      socket.off('force-mute')
      socket.off('opponent-left')
      socket.off('opponent-skipped')
      socket.off('new-words-vote-update')
      socket.off('new-words-generated')
      socket.off('start-countdown')
      socket.off('mic-privilege-updated')
    }
  }, [socket, roomId, nickname])

  const setupWebRTC = async (isInitiator: boolean, socket: Socket) => {
    try {
      console.log(`🎙️ Setting up WebRTC as ${isInitiator ? 'INITIATOR' : 'RECEIVER'}`)

      // Clean up any existing peer connection
      if (peerRef.current) {
        console.log('Cleaning up existing peer connection')
        peerRef.current.destroy()
        peerRef.current = null
      }

      // Clean up any existing streams
      if (localStreamRef.current) {
        console.log('Cleaning up existing stream')
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }

      // Clear signal queue
      signalQueueRef.current = []

      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check if mic is available
      console.log('🎙️ Requesting microphone access...')
      
      // Get user's audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      }).catch((error) => {
        console.error('❌ Microphone access denied or failed:', error)
        alert('⚠️ Microphone access required!\n\nPlease allow microphone access to battle.\n\nClick OK and refresh the page, then allow mic access.')
        throw error
      })
      
      console.log('✅ Got local audio stream')
      console.log('🔊 Audio tracks:', stream.getAudioTracks().length)
      localStreamRef.current = stream
      
      // DISABLE mic for BOTH players initially (will be enabled after initial countdown)
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = false
        setIsMuted(true)
        console.log('🔇 Mic DISABLED initially - will enable after first countdown for first player')
      }

      // Create peer connection with better config for stability and cross-browser support
      const newPeer = new SimplePeer({
        initiator: isInitiator,
        stream: stream,
        trickle: true, // Changed to true for better stability
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ],
          iceTransportPolicy: 'all', // Allow both STUN and TURN candidates
          bundlePolicy: 'max-bundle', // Use bundling for better performance
          rtcpMuxPolicy: 'require', // Multiplex RTP and RTCP for better NAT traversal
          iceCandidatePoolSize: 10
        }
      })

      let hasSentOffer = false
      let candidateCount = 0
      
      newPeer.on('signal', (signal) => {
        if (!hasSentOffer && signal.type === 'offer') {
          hasSentOffer = true
          console.log('📤 Sending WebRTC offer to opponent')
          socket.emit('webrtc-signal', { roomId, signal })
        } else if (signal.type === 'answer') {
          console.log('📤 Sending WebRTC answer to opponent')
          socket.emit('webrtc-signal', { roomId, signal })
        } else if (signal.candidate || signal.type === 'candidate') {
          // CRITICAL FIX: Send ALL candidates (no limit!)
          // Each candidate is a potential connection path - we need all of them
          candidateCount++
          console.log(`📤 Sending ICE candidate #${candidateCount} to opponent`)
          socket.emit('webrtc-signal', { roomId, signal })
        }
      })

      newPeer.on('connect', () => {
        console.log('✅ WebRTC DATA CHANNEL established!')
      })

      newPeer.on('data', (data) => {
        console.log('Received data:', data)
      })

      newPeer.on('stream', (remoteStream) => {
        console.log('✅ Receiving remote audio stream!')
        console.log('📊 Remote stream tracks:', remoteStream.getTracks().length)
        console.log('📊 Remote audio tracks:', remoteStream.getAudioTracks().length)
        
        if (remoteStream.getAudioTracks().length === 0) {
          console.error('❌ Remote stream has NO audio tracks!')
          return
        }
        
        if (remoteAudioRef.current) {
          console.log('🔊 Attaching remote stream to audio element...')
          remoteAudioRef.current.srcObject = remoteStream
          
          // iOS fix: Must call play() with promise handling
          remoteAudioRef.current.play()
            .then(() => {
              console.log('✅ Remote audio playing successfully!')
            })
            .catch(e => {
              console.warn('⚠️ Audio autoplay prevented, trying with user interaction...')
              // Show alert to trigger user interaction for iOS
              setTimeout(() => {
                alert('🔊 Tap OK to hear your opponent!')
                remoteAudioRef.current?.play()
                  .then(() => console.log('✅ Remote audio started after user interaction'))
                  .catch(err => console.error('❌ Still cannot play remote audio:', err))
              }, 500)
            })
        } else {
          console.error('❌ remoteAudioRef.current is null!')
        }
      })

      newPeer.on('error', (err) => {
        console.error('❌ WebRTC error:', err)
        // Log error details for debugging
        console.error('Error name:', err.name)
        console.error('Error message:', err.message)
        
        // Don't immediately disconnect - some errors are recoverable
        // The connection might still succeed with remaining ICE candidates
        if (err.message?.includes('Ice connection failed') || err.message?.includes('Connection failed')) {
          console.warn('⚠️ ICE connection issue detected - this may resolve automatically')
        }
      })

      newPeer.on('close', () => {
        console.log('🔌 WebRTC connection closed')
      })
      
      // CRITICAL: Monitor ICE connection state changes for debugging
      // This helps us see WHY connections fail
      try {
        // Access the underlying RTCPeerConnection for state monitoring
        const pc = (newPeer as any)._pc
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', pc.iceConnectionState)
            if (pc.iceConnectionState === 'failed') {
              console.error('❌ ICE connection FAILED! Possible causes:')
              console.error('  - Firewall blocking WebRTC')
              console.error('  - Network restrictions (school/corporate)')
              console.error('  - NAT traversal failed')
              console.error('  - Missing STUN/TURN servers')
            } else if (pc.iceConnectionState === 'disconnected') {
              console.warn('⚠️ ICE connection DISCONNECTED! May reconnect automatically...')
            } else if (pc.iceConnectionState === 'connected') {
              console.log('✅ ICE connection CONNECTED!')
            } else if (pc.iceConnectionState === 'completed') {
              console.log('✅ ICE connection COMPLETED!')
            }
          }
          
          pc.onicegatheringstatechange = () => {
            console.log('🧊 ICE gathering state:', pc.iceGatheringState)
          }
          
          pc.onconnectionstatechange = () => {
            console.log('🔗 Peer connection state:', pc.connectionState)
            if (pc.connectionState === 'connected') {
              console.log('✅ Peer connection ESTABLISHED! Audio should work now.')
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not access peer connection for state monitoring:', e)
      }

      setPeer(newPeer)
      peerRef.current = newPeer
      
      // Process any queued signals NOW that peer is created
      console.log(`📦 Processing ${signalQueueRef.current.length} queued signals`)
      while (signalQueueRef.current.length > 0) {
        const queuedSignal = signalQueueRef.current.shift()
        try {
          newPeer.signal(queuedSignal)
          console.log('✅ Processed queued signal:', queuedSignal.type || 'candidate')
        } catch (error) {
          console.warn('⚠️ Failed to process queued signal:', error)
        }
      }
    } catch (err) {
      console.error('❌ Failed to get microphone:', err)
      alert('Please allow microphone access to battle! Check browser permissions.')
    }
  }

  const startTimer = (duration: number) => {
    // Clear any existing battle timer
    if (battleTimerRef.current) {
      clearInterval(battleTimerRef.current)
      battleTimerRef.current = null
    }
    
    setTimeLeft(duration)
    let currentTime = duration
    battleTimerRef.current = setInterval(() => {
      currentTime -= 1
      setTimeLeft(currentTime)
      if (currentTime <= 0) {
        clearInterval(battleTimerRef.current!)
        battleTimerRef.current = null
        
        // CRITICAL: Only the player with mic privilege should initiate the switch
        // The other player will just receive the mic-privilege-updated event
        if (hasMicPrivilegeRef.current) {
          console.log('⏰ Timer ended - I have mic, initiating switch')
          startCountdown()
        } else {
          console.log('⏰ Timer ended - I DON\'T have mic, waiting for opponent to switch')
          // Just wait for the mic-privilege-updated event
        }
      }
    }, 1000)
  }

  const audioTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const battleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const globalTurnCountRef = useRef(0) // Track TOTAL turns (4 turns = 2 per player)
  const isInitialCountdownRef = useRef(true) // Flag for initial vs switch countdown
  
  // Debug function to log current state
  const logCurrentState = () => {
    console.log('🔍 Current State:', {
      hasMicPrivilege,
      hasMicPrivilegeRef: hasMicPrivilegeRef.current,
      battleMode,
      isMuted,
      opponentName,
      timeLeft
    })
  }
  
  // Handle redirect countdown when battle ends
  useEffect(() => {
    if (battleMode === 'ended') {
      console.log('🏁 Battle ended - starting 30-second redirect countdown')
      setRedirectCountdown(30)
      let currentCount = 30
      redirectIntervalRef.current = setInterval(() => {
        currentCount -= 1
        setRedirectCountdown(currentCount)
        if (currentCount <= 0) {
          if (redirectIntervalRef.current) {
            clearInterval(redirectIntervalRef.current)
            redirectIntervalRef.current = null
          }
          console.log('⏰ Redirect countdown finished - returning to homepage')
          onLeave()
        }
      }, 1000)
      
      return () => {
        if (redirectIntervalRef.current) {
          clearInterval(redirectIntervalRef.current)
          redirectIntervalRef.current = null
        }
      }
    }
  }, [battleMode, onLeave])
  
  const audioTimerValueRef = useRef(360) // Track actual time value
  
  const startAudioTimer = () => {
    setAudioTimer(360) // Reset to 6 minutes (360 seconds)
    audioTimerValueRef.current = 360
    console.log('⏲️ Audio timer STARTED at 360 seconds (6:00)')
    audioTimerRef.current = setInterval(() => {
      audioTimerValueRef.current -= 1
      setAudioTimer(audioTimerValueRef.current)
      if (audioTimerValueRef.current <= 0) {
        console.log('⏰ 6-minute audio timer hit 0:00 - ending battle!')
        if (audioTimerRef.current) {
          clearInterval(audioTimerRef.current)
          audioTimerRef.current = null
        }
        // Stop the round timer too
        if (battleTimerRef.current) {
          clearInterval(battleTimerRef.current)
          battleTimerRef.current = null
        }
        // Stop countdown if active
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        setBattleMode('ended')
      }
    }, 1000)
  }
  
  const pauseAudioTimer = () => {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current)
      audioTimerRef.current = null
      const minutes = Math.floor(audioTimerValueRef.current / 60)
      const seconds = audioTimerValueRef.current % 60
      console.log(`⏸️ Audio timer PAUSED at ${minutes}:${seconds.toString().padStart(2, '0')} (${audioTimerValueRef.current}s)`)
    }
  }
  
  const resumeAudioTimer = () => {
    // Resume from where we left off
    const minutes = Math.floor(audioTimerValueRef.current / 60)
    const seconds = audioTimerValueRef.current % 60
    console.log(`▶️ Audio timer RESUMED from ${minutes}:${seconds.toString().padStart(2, '0')} (${audioTimerValueRef.current}s)`)
    audioTimerRef.current = setInterval(() => {
      audioTimerValueRef.current -= 1
      setAudioTimer(audioTimerValueRef.current)
      if (audioTimerValueRef.current <= 0) {
        console.log('⏰ 6-minute audio timer hit 0:00 - ending battle!')
        if (audioTimerRef.current) {
          clearInterval(audioTimerRef.current)
          audioTimerRef.current = null
        }
        // Stop the round timer too
        if (battleTimerRef.current) {
          clearInterval(battleTimerRef.current)
          battleTimerRef.current = null
        }
        setBattleMode('ended')
      }
    }, 1000)
  }

  // Store the expected next mic state to prevent race conditions
  const nextMicStateRef = useRef<boolean | null>(null)
  
  const startCountdown = () => {
    console.log('🔄 Starting countdown for mic switch...')
    console.log('🔄 My nickname:', nickname)
    console.log('🔄 Current hasMicPrivilege:', hasMicPrivilege)
    console.log('🔄 Current hasMicPrivilegeRef:', hasMicPrivilegeRef.current)
    
    // Store current mic state - I currently HAVE the mic (since only player with mic calls this)
    const myCurrentMicState = hasMicPrivilegeRef.current
    
    // I have mic, so I'm LOSING it (opponent is getting it)
    const willGetMicNext = false
    nextMicStateRef.current = willGetMicNext
    setNextHasMic(willGetMicNext)
    console.log('🔄 I have mic now, losing it next. willGetMicNext:', willGetMicNext)
    
    // Clear any existing countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    
    // Pause audio timer during countdown
    pauseAudioTimer()
    
    // Emit to server AND tell opponent to start countdown
    socket.emit('switch-mic-privilege', { roomId })
    socket.emit('start-countdown', { roomId }) // Tell opponent to start countdown too!
    
    setBattleMode('countdown')
    setCountdown(5)
    let currentCount = 5
    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1
      setCountdown(currentCount)
      
      // Send heartbeat to keep connection alive (especially for mobile browsers)
      socket.emit('heartbeat', { roomId })
      
      if (currentCount <= 0) {
        clearInterval(countdownIntervalRef.current!)
        countdownIntervalRef.current = null
        setCountdown(0) // Reset countdown
        
        // Increment GLOBAL turn count (both clients do this)
        globalTurnCountRef.current += 1
        console.log(`📊 Switch ${globalTurnCountRef.current}/4 complete`)
        
        // Unlock voting for the new round
        setVoteLocked(false)
        console.log('🔓 Vote unlocked for new round')
        
        // Check if battle should end (4 switches total = initial + 3 more)
        if (globalTurnCountRef.current >= 4) {
          console.log('🏁 4 switches completed - ending battle!')
          setBattleMode('ended')
          if (audioTimerRef.current) clearInterval(audioTimerRef.current)
          if (battleTimerRef.current) clearInterval(battleTimerRef.current)
          return
        }
        
        console.log('⏰ Countdown finished, transitioning to battle mode')
        console.log('🎤 My nickname:', nickname)
        console.log('🎤 Current mic privilege AFTER switch:', hasMicPrivilegeRef.current)
        
        // Transition to battle mode based on who has mic privilege
        // Use the ref to get the current mic privilege value
        setBattleMode(hasMicPrivilegeRef.current ? 'player1' : 'player2')
        startTimer(90) // Start the 1:30 timer
        resumeAudioTimer() // Resume audio timer
        nextMicStateRef.current = null // Reset for next switch
        console.log('✅ Battle resumed with switched mic privileges')
      }
    }, 1000)
  }

  const switchTurns = () => {
    setBattleMode(prevMode => {
      if (prevMode === 'player1') {
        setHasMicPrivilege(false)
        return 'player2'
      } else if (prevMode === 'player2') {
        setHasMicPrivilege(true)
        return 'player1'
      } else if (prevMode === 'countdown') {
        // If in countdown mode, switch to opposite of current mic privilege
        setHasMicPrivilege(prev => !prev)
        return hasMicPrivilege ? 'player2' : 'player1'
      } else {
        // Default fallback
        setHasMicPrivilege(true)
        return 'player1'
      }
    })
  }

  const toggleMute = () => {
    // Only allow muting/unmuting if you have mic privilege
    if (!hasMicPrivilege) {
      console.log('🚫 Cannot toggle mute - you do not have mic privilege')
      return
    }
    
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        // Toggle the audio track
        const newEnabledState = !audioTrack.enabled
        audioTrack.enabled = newEnabledState
        setIsMuted(!newEnabledState)
        console.log(newEnabledState ? '🎤 Unmuted by user (you can speak)' : '🔇 Muted by user (you cannot speak)')
      }
    }
  }

  const handleVoteNewWords = () => {
    // Check if max words changes reached (2)
    if (wordsChangedCount >= 2) {
      console.log('⚠️ Cannot vote for new words - max 2 changes per battle reached')
      return
    }
    
    // Check if already voted this round (prevent spam)
    if (voteLocked) {
      console.log('⚠️ Already voted this round - wait for next round to change vote')
      return
    }
    
    // Lock vote for this round
    setVoteLocked(true)
    setHasVotedNewWords(true)
    socket.emit('vote-new-words', { roomId, vote: true })
    console.log('🗳️ Voted for new words (locked for this round)')
  }

  const sendMessage = () => {
    if (newMessage.trim() && socket) {
      const message = {
        id: Date.now().toString(),
        user: nickname,
        message: newMessage.trim(),
        timestamp: Date.now()
      }
      setChatMessages(prev => [...prev, message])
      socket.emit('chat-message', message)
      setNewMessage('')
    }
  }

  const handleSkip = () => {
    if (confirm('Are you sure you want to skip this battle?')) {
      socket.emit('skip-battle', { roomId })
      onLeave()
    }
  }

  // Update audio volumes when they change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = beatVolume // Beat volume is direct (no master volume)
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = opponentVolume // Opponent mic volume (client-side only!)
    }
  }, [beatVolume, opponentVolume])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-roast-dark to-black">
      {/* Hidden audio elements */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        webkit-playsinline="true"
        onLoadedMetadata={() => console.log('🎵 Remote audio metadata loaded')}
        onPlay={() => console.log('▶️ Remote audio playing')}
        onPause={() => console.log('⏸️ Remote audio paused')}
        onError={(e) => console.error('❌ Remote audio error:', e)}
      />
             <audio 
               ref={audioRef} 
               src={selectedBeat ? `/audio/${selectedBeat}.mp3` : "/audio/hmm-freestyle-beat.mp3"} 
               loop 
               playsInline
               webkit-playsinline="true"
               preload="auto"
               onError={(e) => {
                 console.log('Beat audio not found:', e.currentTarget.src)
                 console.log('Add your beat file to public/audio/')
               }}
               onLoadStart={() => console.log('🎵 Loading audio:', selectedBeat ? `/audio/${selectedBeat}.mp3` : "/audio/hmm-freestyle-beat.mp3")}
               onCanPlay={() => console.log('✅ Audio can play:', selectedBeat ? `/audio/${selectedBeat}.mp3` : "/audio/hmm-freestyle-beat.mp3")}
               onPlay={() => console.log('▶️ Audio started playing')}
               onPause={() => console.log('⏸️ Audio paused')}
             />

      {battleMode === 'waiting' && (
        <div className="text-center animate-slide-up">
          <div className="text-6xl mb-4 animate-pulse-subtle">⚔️</div>
          <h2 className="text-4xl font-bold text-roast-cream mb-4">
            Battle Starting...
          </h2>
          <p className="text-xl text-roast-cream/70 mb-4">
            Your contestant is <span className="text-roast-red font-bold">{opponentName}</span>
          </p>
          {countdown > 0 && (
            <div>
              <div className="text-8xl font-bold text-roast-red mb-4 animate-pulse">
                {countdown}
              </div>
              <p className="text-xl text-roast-cream/70">
                {hasMicPrivilege ? "🎤 You're starting off with the mic! Get ready to spit!" : "🎧 Opponent is starting off with the mic! Listen up!"}
              </p>
            </div>
          )}
          {countdown === 0 && (
            <p className="text-xl text-roast-cream/70">
              Get ready to throw down!
            </p>
          )}
        </div>
      )}

      {showBeatSelection && (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center animate-slide-up">
            <div className="text-6xl mb-4 animate-spin">🎲</div>
            <h2 className="text-4xl font-bold text-roast-cream mb-4">
              Choosing Beat...
            </h2>
            <div className="text-2xl text-roast-cream/70 mb-4">
              {selectedBeat ? `Selected: ${selectedBeat}` : 'Rolling...'}
            </div>
            <div className="text-6xl font-bold text-roast-red mb-4 animate-pulse">
              🎵
            </div>
          </div>
        </div>
      )}

      {battleMode === 'countdown' && !showBeatSelection && (
        <div className="text-center animate-slide-up">
          <div className="text-6xl mb-4 animate-pulse-subtle">🎤</div>
          <h2 className="text-4xl font-bold text-roast-cream mb-4">
            {nextHasMic ? "Ready? You're about to start!" : "Ready? Opponent's about to start!"}
          </h2>
          <div className="text-8xl font-bold text-roast-red mb-4 animate-pulse">
            {countdown}
          </div>
          <p className="text-xl text-roast-cream/70">
            {nextHasMic ? "🎤 You're up next - Get ready to spit!" : "🎧 Opponent's up next - Listen!"}
          </p>
        </div>
      )}

      {battleMode !== 'waiting' && battleMode !== 'countdown' && (
        <div className="w-full max-w-4xl">
          {/* Battle Header */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* You */}
            <div className={`p-6 rounded-lg border-2 transition-all ${
              hasMicPrivilege
                ? 'bg-roast-red/20 border-roast-red shadow-lg shadow-roast-red/50' 
                : 'bg-roast-dark/50 border-roast-red/30'
            }`}>
              <p className="text-roast-cream/60 text-sm mb-1">YOU</p>
              <p className="text-2xl font-bold text-roast-cream truncate">
                {DOMPurify.sanitize(nickname, { ALLOWED_TAGS: [] })}
              </p>
              {hasMicPrivilege && <p className="text-roast-red text-sm font-bold">🎤 MIC</p>}
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className={`text-6xl font-bold mb-2 ${
                  timeLeft <= 10 ? 'text-roast-red animate-pulse' : 'text-roast-cream'
                }`}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-roast-cream/60 text-sm">time left</p>
              </div>
            </div>

            {/* Opponent */}
            <div className={`p-6 rounded-lg border-2 transition-all ${
              !hasMicPrivilege
                ? 'bg-roast-red/20 border-roast-red shadow-lg shadow-roast-red/50' 
                : 'bg-roast-dark/50 border-roast-red/30'
            }`}>
              <p className="text-roast-cream/60 text-sm mb-1">OPPONENT</p>
              <p className="text-2xl font-bold text-roast-cream truncate">
                {DOMPurify.sanitize(opponentName, { ALLOWED_TAGS: [] })}
              </p>
              {!hasMicPrivilege && <p className="text-roast-red text-sm font-bold">🎤 MIC</p>}
            </div>
          </div>

          {/* Battle Words/Topic */}
          {battleWords.length > 0 && (
            <div className="mb-8 p-8 bg-gradient-to-r from-roast-red/20 to-roast-dark/50 rounded-lg border-2 border-roast-red">
              <p className="text-roast-cream/60 text-sm mb-3 text-center">BATTLE WORDS:</p>
              <div className="flex justify-center gap-4">
                {battleWords.map((word, idx) => (
                  <span key={idx} className="text-3xl font-bold text-roast-cream bg-roast-dark/50 px-6 py-3 rounded-lg">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Current Turn Indicator */}
          <div className="mb-8 text-center">
            <div className="inline-block px-8 py-4 bg-roast-red rounded-full">
              <p className="text-xl font-bold text-roast-cream">
                {hasMicPrivilege ? "🎤 YOUR TURN - SPIT SOME BARS!" : "🎧 LISTEN & WAIT YOUR TURN"}
              </p>
            </div>
          </div>

          {/* Volume Controls */}
          <div className="mb-12 mt-8 grid grid-cols-2 gap-6">
            <div className="text-center">
              <label className="text-roast-cream/70 text-sm block mb-2">Beat Volume</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={beatVolume}
                onChange={(e) => setBeatVolume(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-roast-cream text-xs">{Math.round(beatVolume * 100)}%</span>
            </div>
            <div className="text-center">
              <label className="text-roast-cream/70 text-sm block mb-2">Opponent Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opponentVolume}
                onChange={(e) => setOpponentVolume(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-roast-cream text-xs">{Math.round(opponentVolume * 100)}%</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={toggleMute}
            disabled={!hasMicPrivilege}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
              hasMicPrivilege
                ? 'bg-roast-red text-roast-cream hover:bg-roast-red/90 cursor-pointer'
                : 'bg-gray-600 border-2 border-gray-500 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            🎤 {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>

            <button
              onClick={handleVoteNewWords}
              disabled={wordsChangedCount >= 2}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
                wordsChangedCount >= 2
                  ? 'bg-roast-dark/50 border-2 border-roast-cream/20 text-roast-cream/40 cursor-not-allowed'
                  : hasVotedNewWords && opponentVotedNewWords
                    ? 'bg-green-600 border-2 border-green-500 text-roast-cream'
                    : hasVotedNewWords || opponentVotedNewWords
                      ? 'bg-roast-red border-2 border-roast-red text-roast-cream hover:bg-roast-red/80'
                      : 'bg-roast-dark border-2 border-roast-red/50 text-roast-cream hover:border-roast-red'
              }`}
            >
              {wordsChangedCount >= 2 
                ? '🔄 NEW WORDS (MAX REACHED)' 
                : hasVotedNewWords && opponentVotedNewWords
                  ? '✅ CHANGING NEXT ROUND!'
                  : `🔄 NEW WORDS ${(hasVotedNewWords ? 1 : 0) + (opponentVotedNewWords ? 1 : 0)}/2`
              }
            </button>

            <button
              onClick={handleSkip}
              className="px-8 py-4 rounded-lg font-bold text-lg bg-roast-dark border-2 border-roast-cream/30 text-roast-cream/70 hover:border-roast-cream/50 transition-all"
            >
              ⏭️ SKIP
            </button>
          </div>

          {/* Chat System */}
          <div className="mb-8">
            <div className="bg-roast-dark/50 rounded-lg border border-roast-red/30 p-4 mb-4">
              <div className="h-32 overflow-y-auto mb-4 space-y-2">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className="text-roast-red font-bold">
                      {DOMPurify.sanitize(msg.user, { ALLOWED_TAGS: [] })}:
                    </span>
                    <span className="text-roast-cream ml-2">
                      {DOMPurify.sanitize(msg.message, { ALLOWED_TAGS: [] })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a comment..."
                  className="flex-1 bg-roast-dark border border-roast-red/30 rounded px-3 py-2 text-roast-cream placeholder-roast-cream/50"
                />
                <button
                  onClick={sendMessage}
                  className="bg-roast-red hover:bg-roast-red/90 text-roast-cream px-4 py-2 rounded"
                >
                  Send
                </button>
              </div>
            </div>

            {/* 6-Minute Audio Timer & Beat Info */}
            <div className="bg-roast-dark/50 rounded-lg border border-roast-red/30 p-4 text-center">
              <div className="text-roast-cream/70 text-sm mb-2">AUDIO TIMER</div>
              <div className="text-4xl font-bold text-roast-red mb-2">
                {Math.floor(audioTimer / 60).toString().padStart(2, '0')}:{(audioTimer % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-roast-cream/60 text-sm mb-3">
                {audioTimer > 0 ? 'Time remaining' : 'Audio finished!'}
              </div>
              <div className="border-t border-roast-red/30 pt-3">
                <div className="text-roast-cream/90 text-sm">
                  🎵 <span className="font-bold">Playing:</span> {selectedBeat || 'hmm-freestyle-beat'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Battle Ended Overlay */}
      {battleMode === 'ended' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fade-in">
          <div className="text-center p-12 bg-gradient-to-b from-roast-dark to-black rounded-lg border-2 border-roast-red shadow-2xl max-w-2xl">
            <div className="text-8xl mb-6 animate-bounce-slow">🔥</div>
            <h3 className="text-5xl font-bold text-roast-cream mb-4">
              BATTLE COMPLETE!
            </h3>
            <p className="text-2xl text-roast-red font-bold mb-6">
              Who spit the hottest bars?
            </p>
            <div className="mb-8 p-6 bg-roast-red/10 rounded-lg border border-roast-red/30">
              <p className="text-roast-cream/70 text-lg">
                Redirecting to homepage in{' '}
                <span className="text-roast-red font-bold text-2xl">{redirectCountdown}</span>{' '}
                seconds...
              </p>
            </div>
            <button
              onClick={onLeave}
              className="bg-roast-red hover:bg-roast-red/90 text-roast-cream font-bold text-xl px-12 py-4 rounded-lg transition-all hover:scale-105"
            >
              🏠 RETURN TO HOMEPAGE NOW
            </button>
          </div>
        </div>
      )}
    </div>
  )
}