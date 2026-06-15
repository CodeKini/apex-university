'use client'

import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-slate-500">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold text-white mb-3">You're offline</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          No internet connection detected. Check your connection and try again.
          Public course pages you've visited before may still be available.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Try again
          </button>
          <Link href="/" className="btn-ghost w-full block">
            Go home
          </Link>
        </div>

        <p className="text-xs text-slate-600 mt-8">
          Paid lesson content is never stored offline to protect your privacy and course security.
        </p>
      </div>
    </div>
  )
}
