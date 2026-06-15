'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams }  from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }  from '@/lib/workspace/context'
import { Send, Loader2, MessageSquare, ArrowLeft } from 'lucide-react'

interface Conv {
  id:              string
  participant_ids: string[]
  last_message_at: string
  other:           { id: string; full_name: string; email: string } | null
  latest:          { body: string; sender_id: string } | null
  unread:          number
}

interface Message {
  id:         string
  body:       string
  sender_id:  string
  created_at: string
  sender:     { id: string; full_name: string }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function MessagesPage() {
  const { workspace: slug }  = useParams<{ workspace: string }>()
  const { workspace }        = useWorkspace()
  const searchParams         = useSearchParams()
  const supabase             = createClientComponentClient()
  const bottomRef            = useRef<HTMLDivElement>(null)

  const [userId,       setUserId]       = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conv[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get('conv'))
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [msgLoading,   setMsgLoading]   = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      await fetchConversations()
      setLoading(false)
    }
    init()
  }, [workspace.id])

  useEffect(() => {
    if (activeConvId) fetchMessages(activeConvId)
  }, [activeConvId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchConversations() {
    const res  = await fetch(`/api/community/dm/conversations?workspaceId=${workspace.id}`)
    const data = await res.json()
    setConversations(data.conversations ?? [])
  }

  async function fetchMessages(convId: string) {
    setMsgLoading(true)
    const res  = await fetch(`/api/community/dm/conversations/${convId}/messages`)
    const data = await res.json()
    setMessages(data.messages ?? [])
    setMsgLoading(false)
    // mark as read in list
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread: 0 } : c))
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!activeConvId || !input.trim()) return
    setSending(true)
    const res  = await fetch(`/api/community/dm/conversations/${activeConvId}/messages`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ body: input.trim() }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) {
      setMessages((prev) => [...prev, data.message])
      setInput('')
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId)

  return (
    <div className="h-[calc(100vh-200px)] flex gap-4">
      {/* Inbox */}
      <div className={`w-64 shrink-0 flex flex-col ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <h2 className="text-sm font-semibold text-white mb-3">Messages</h2>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-sm gap-2">
            <MessageSquare size={24} />
            <span>No messages yet.</span>
            <span className="text-xs">Visit a member's profile to start a conversation.</span>
          </div>
        ) : (
          <div className="space-y-1 overflow-y-auto flex-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  activeConvId === conv.id ? 'bg-navy-700' : 'hover:bg-navy-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${conv.unread > 0 ? 'text-white' : 'text-slate-300'}`}>
                    {conv.other?.full_name ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-slate-500">{timeAgo(conv.last_message_at)}</span>
                </div>
                {conv.latest && (
                  <div className="text-xs text-slate-500 truncate mt-0.5">{conv.latest.body}</div>
                )}
                {conv.unread > 0 && (
                  <span className="inline-block mt-1 text-[10px] bg-gold-500 text-black px-1.5 py-0.5 rounded-full font-bold">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat pane */}
      <div className="flex-1 flex flex-col card overflow-hidden min-h-0">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a conversation to read messages.
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-navy-800 flex items-center gap-3">
              <button
                onClick={() => setActiveConvId(null)}
                className="md:hidden text-slate-500 hover:text-slate-300"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-slate-300">
                {activeConv?.other?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="font-medium text-white text-sm">{activeConv?.other?.full_name ?? 'Unknown'}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {msgLoading ? (
                <div className="flex justify-center text-slate-500"><Loader2 size={16} className="animate-spin" /></div>
              ) : messages.map((msg) => {
                const mine = msg.sender_id === userId
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3.5 py-2 rounded-2xl text-sm ${
                      mine
                        ? 'bg-gold-500/20 text-gold-100 rounded-br-sm'
                        : 'bg-navy-700 text-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.body}
                      <div className={`text-[10px] mt-1 ${mine ? 'text-gold-400/60' : 'text-slate-500'}`}>
                        {timeAgo(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-navy-800 flex gap-2">
              <input
                type="text"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={5000}
                className="input-field text-sm flex-1"
              />
              <button type="submit" disabled={sending || !input.trim()} className="btn-primary text-sm px-3">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
