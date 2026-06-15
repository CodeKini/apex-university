'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'apex_pwa_install_dismissed'

export default function InstallPrompt() {
  const [prompt,    setPrompt]    = useState<BeforeInstallPromptEvent | null>(null)
  const [visible,   setVisible]   = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // User previously dismissed
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    dismiss()
  }

  const dismiss = () => {
    setVisible(false)
    sessionStorage.setItem(DISMISSED_KEY, '1')
  }

  if (!visible || installed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 z-50
                    bg-navy-800 border border-navy-600 rounded-2xl shadow-2xl p-4
                    animate-in slide-in-from-bottom-4 duration-300">
      <button onClick={dismiss}
        className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-gold-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm">Install Apex University</p>
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
            Add to your home screen for faster access to your courses.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={install}
          className="flex-1 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm
                     py-2 rounded-lg transition-colors">
          Install
        </button>
        <button onClick={dismiss}
          className="flex-1 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm
                     py-2 rounded-lg transition-colors">
          Not now
        </button>
      </div>
    </div>
  )
}
