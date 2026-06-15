'use client'

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineContentBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center">
      <span className="text-amber-400 text-xs flex items-center justify-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        You're offline. Lesson content requires an internet connection.
      </span>
    </div>
  )
}
