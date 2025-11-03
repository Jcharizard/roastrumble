'use client'

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

interface LandingPageProps {
  onStartBattle: () => void
}

export default function LandingPage({ onStartBattle }: LandingPageProps) {
  const [usersOnline, setUsersOnline] = useState(0)

  useEffect(() => {
    // Connect briefly to get user count
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001'
    const socket = io(serverUrl)

    socket.on('queue-update', ({ usersOnline }) => {
      setUsersOnline(usersOnline)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-roast-dark to-black relative">
      {/* Users Online Badge */}
      <div className="absolute top-8 right-8 bg-roast-red/20 border-2 border-roast-red rounded-full px-6 py-3 animate-slide-up">
        <p className="text-roast-cream font-bold">
          🔥 <span className="text-2xl">{usersOnline}</span> <span className="text-sm">ONLINE</span>
        </p>
      </div>

      {/* Logo Section */}
      <div className="text-center mb-12 animate-slide-up">
        <div className="mb-8">
          {/* Your logo image */}
          <div className="w-48 h-48 mx-auto bg-roast-red rounded-full flex items-center justify-center fire-effect overflow-hidden">
            <img 
              src="/logo.png" 
              alt="RoastRumble Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to emoji if logo not found
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling.style.display = 'block'
              }}
            />
            <div className="text-6xl hidden">🎤🔥</div>
          </div>
        </div>
        
        <h1 className="text-7xl font-bold mb-4 text-roast-cream">
          ROAST RUMBLE
        </h1>
        
        <p className="text-xl text-roast-cream/80 mb-8 max-w-2xl mx-auto">
          Battle random opponents in real-time freestyle rap battles.
          <br />
          No signup. No BS. Just bars. 🔥
        </p>
      </div>

      {/* CTA Button */}
      <button
        onClick={onStartBattle}
        className="bg-roast-red hover:bg-roast-red/90 text-roast-cream font-bold text-2xl px-16 py-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-roast-red/50"
      >
        START BATTLING
      </button>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl">
        <div className="text-center p-6 bg-roast-dark/50 rounded-lg border border-roast-red/30">
          <div className="text-4xl mb-3">⚡</div>
          <h3 className="text-xl font-bold text-roast-cream mb-2">Instant Matches</h3>
          <p className="text-roast-cream/70">Jump in and find opponents in seconds</p>
        </div>
        
        <div className="text-center p-6 bg-roast-dark/50 rounded-lg border border-roast-red/30">
          <div className="text-4xl mb-3">🎵</div>
          <h3 className="text-xl font-bold text-roast-cream mb-2">Live Audio</h3>
          <p className="text-roast-cream/70">Real-time voice chat with sick beats</p>
        </div>
        
        <div className="text-center p-6 bg-roast-dark/50 rounded-lg border border-roast-red/30">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-xl font-bold text-roast-cream mb-2">Battle Mode</h3>
          <p className="text-roast-cream/70">Freestyle 2 Randomly Selected Themes</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-roast-cream/50 text-sm w-full px-4">
        <div className="max-w-4xl mx-auto">
          <p className="mb-2">Made with 🔥 by a 16-year-old with a dream - @queefking3993 on ig</p>
          <p className="mb-3">
            <a href="https://github.com/yourusername/roastrumble" target="_blank" rel="noopener noreferrer" className="hover:text-roast-red transition-colors">GitHub</a>
            {' • '}
            <a href="https://paypal.me/BigBoyJulio" target="_blank" rel="noopener noreferrer" className="hover:text-roast-red transition-colors">Donate</a>
            {' • '}
            <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Privacy Policy: We collect ZERO data. No accounts, no tracking, no storage. Your IP may be visible to opponents during P2P battles (standard WebRTC). Use a VPN if concerned. That\'s it!'); }} className="hover:text-roast-red transition-colors cursor-pointer">Privacy</a>
            {' • '}
            <a href="https://discord.gg/QCc6nhZ8bD" target="_blank" rel="noopener noreferrer" className="hover:text-roast-red transition-colors">Discord - Community & Contact</a>
          </p>
          <p className="text-xs text-roast-cream/40 max-w-2xl mx-auto">
            ⚠️ This site uses WebRTC peer-to-peer for audio.  
            We store NO data. Open source. Use a VPN for extra privacy.
          </p>
        </div>
      </div>
    </div>
  )
}

