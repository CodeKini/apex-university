'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border',
      'animate-in slide-in-from-bottom-4 fade-in duration-300',
      type === 'success'
        ? 'bg-navy-800 border-emerald-500/30 text-emerald-400'
        : 'bg-navy-800 border-red-500/30 text-red-400'
    )}>
      {type === 'success'
        ? <CheckCircle className="w-5 h-5 shrink-0" />
        : <XCircle className="w-5 h-5 shrink-0" />}
      <p className="text-sm text-slate-200">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-500 hover:text-slate-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
