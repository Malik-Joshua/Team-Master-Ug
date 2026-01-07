'use client'

import { useEffect, useState } from 'react'
import { Cake, X } from 'lucide-react'

interface BirthdayInfo {
  birthdaysToday: Array<{ user_id: string; name: string }>
  isUserBirthday: boolean
}

export default function BirthdayAlert() {
  const [birthdayInfo, setBirthdayInfo] = useState<BirthdayInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkBirthdays = async () => {
      try {
        const response = await fetch('/api/birthdays/check', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setBirthdayInfo(data)
        }
      } catch (error) {
        console.error('Error checking birthdays:', error)
      }
    }

    checkBirthdays()
  }, [])

  if (!birthdayInfo || dismissed) return null

  // Show "Happy Birthday" message for the user
  if (birthdayInfo.isUserBirthday) {
    return (
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-card p-6 mb-6 shadow-large border-2 border-white/20 relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-4">
            <Cake className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-1">🎉 Happy Birthday! 🎉</h3>
            <p className="text-white/90 text-lg">
              Wishing you a wonderful day filled with joy and celebration!
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show birthday alerts for other users
  if (birthdayInfo.birthdaysToday.length > 0) {
    return (
      <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-card p-4 mb-6 shadow-soft border border-orange-300 relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-neutral-700 hover:text-neutral-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <Cake className="w-6 h-6 text-white" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-1">
              🎂 Birthday Alert! 🎂
            </p>
            <p className="text-sm text-white/90">
              {birthdayInfo.birthdaysToday.length === 1
                ? `Today is ${birthdayInfo.birthdaysToday[0].name}'s birthday!`
                : `Today is ${birthdayInfo.birthdaysToday.map(b => b.name).join(', ')}'s birthday!`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

