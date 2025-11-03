'use client'

import { useState } from 'react'

interface NicknameEntryProps {
  onSubmit: (nickname: string) => void
}

export default function NicknameEntry({ onSubmit }: NicknameEntryProps) {
  const [nickname, setNickname] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nickname.trim().length > 0) {
      onSubmit(nickname.trim())
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-roast-dark to-black">
      <div className="w-full max-w-md animate-slide-up">
        <h2 className="text-5xl font-bold text-roast-cream mb-4 text-center">
          Choose Your Name
        </h2>
        <p className="text-roast-cream/70 text-center mb-8">
          Pick a nickname to represent you in battle
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="MC Something..."
            maxLength={20}
            className="w-full bg-roast-dark border-2 border-roast-red/50 focus:border-roast-red text-roast-cream text-xl px-6 py-4 rounded-lg outline-none transition-colors placeholder:text-roast-cream/30"
            autoFocus
          />

          <button
            type="submit"
            disabled={nickname.trim().length === 0}
            className="w-full bg-roast-red hover:bg-roast-red/90 disabled:bg-roast-red/30 disabled:cursor-not-allowed text-roast-cream font-bold text-xl px-8 py-4 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:transform-none shadow-lg"
          >
            FIND OPPONENT
          </button>
        </form>

        <div className="mt-8 p-4 bg-roast-dark/50 rounded-lg border border-roast-red/30">
          <p className="text-roast-cream/60 text-sm text-center">
            💡 Tip: Choose a memorable name. Your opponent will see it!
          </p>
        </div>
      </div>
    </div>
  )
}

