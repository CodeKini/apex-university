'use client'

import type { Toast } from '@/hooks/useToast'

const COLORS = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  info:    'bg-indigo-600',
}

export function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-sm animate-in slide-in-from-bottom-2 ${COLORS[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      ))}
    </div>
  )
}
