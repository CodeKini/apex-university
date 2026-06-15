'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'

interface Notification {
  id:         string
  type:       string
  title:      string
  body?:      string
  link?:      string
  read_at:    string | null
  created_at: string
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationBell({ workspaceId }: { workspaceId: string }) {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [workspaceId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    try {
      const res  = await fetch(`/api/community/notifications?workspaceId=${workspaceId}`)
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {}
  }

  async function markAllRead() {
    await fetch('/api/community/notifications', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ all: true, workspace_id: workspaceId }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open && unreadCount > 0) markAllRead() }}
        className="relative flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-navy-800/60 text-sm rounded-lg transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-navy-900 border border-navy-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-800">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500 text-center">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-navy-800/50 last:border-0 ${
                    !n.read_at ? 'bg-navy-800/40' : ''
                  }`}
                >
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)} className="block hover:opacity-80">
                      <div className="text-sm font-medium text-white">{n.title}</div>
                      {n.body && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</div>}
                      <div className="text-xs text-slate-600 mt-1">{timeAgo(n.created_at)}</div>
                    </Link>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-white">{n.title}</div>
                      {n.body && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</div>}
                      <div className="text-xs text-slate-600 mt-1">{timeAgo(n.created_at)}</div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
