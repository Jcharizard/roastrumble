'use client'

import { useState } from 'react'
import { Socket } from 'socket.io-client'
import LandingPage from '@/components/LandingPage'
import NicknameEntry from '@/components/NicknameEntry'
import QueueWaiting from '@/components/QueueWaiting'
import BattleRoom from '@/components/BattleRoom'

export type GameState = 'landing' | 'nickname' | 'queue' | 'battle'

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('landing')
  const [nickname, setNickname] = useState('')
  const [roomId, setRoomId] = useState('')
  const [socket, setSocket] = useState<Socket | null>(null)

  const handleStartBattle = () => {
    setGameState('nickname')
  }

  const handleNicknameSubmit = (name: string) => {
    setNickname(name)
    setGameState('queue')
  }

  const handleMatchFound = (id: string, sock: Socket) => {
    setRoomId(id)
    setSocket(sock)
    setGameState('battle')
  }

  const handleLeaveBattle = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
    }
    setGameState('landing')
    setNickname('')
    setRoomId('')
  }

  return (
    <main className="min-h-screen">
      {gameState === 'landing' && (
        <LandingPage onStartBattle={handleStartBattle} />
      )}
      
      {gameState === 'nickname' && (
        <NicknameEntry onSubmit={handleNicknameSubmit} />
      )}
      
      {gameState === 'queue' && (
        <QueueWaiting 
          nickname={nickname} 
          onMatchFound={handleMatchFound}
          onCancel={() => setGameState('landing')}
        />
      )}
      
      {gameState === 'battle' && socket && (
        <BattleRoom 
          nickname={nickname}
          roomId={roomId}
          socket={socket}
          onLeave={handleLeaveBattle}
        />
      )}
    </main>
  )
}

