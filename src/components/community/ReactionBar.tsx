'use client'

import { useState } from 'react'

const EMOJIS = ['👍', '❤️', '😂', '😮', '🔥'] as const
type Emoji = typeof EMOJIS[number]

interface Reaction { emoji: string; user_id: string }

interface Props {
  targetType:  'post' | 'comment'
  targetId:    string
  workspaceId: string
  reactions:   Reaction[]
  currentUserId: string
  onUpdate?:   (reactions: Reaction[]) => void
}

export default function ReactionBar({
  targetType, targetId, workspaceId, reactions, currentUserId, onUpdate,
}: Props) {
  const [local, setLocal] = useState<Reaction[]>(reactions)
  const [busy,  setBusy]  = useState<string | null>(null)

  const counts = EMOJIS.reduce<Record<string, number>>((acc, e) => {
    acc[e] = local.filter((r) => r.emoji === e).length
    return acc
  }, {} as Record<string, number>)

  const hasReacted = (emoji: string) => local.some((r) => r.emoji === emoji && r.user_id === currentUserId)

  async function toggle(emoji: Emoji) {
    if (busy) return
    setBusy(emoji)

    const already = hasReacted(emoji)
    // Optimistic update
    setLocal((prev) =>
      already
        ? prev.filter((r) => !(r.emoji === emoji && r.user_id === currentUserId))
        : [...prev, { emoji, user_id: currentUserId }]
    )

    try {
      await fetch('/api/community/reactions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ workspace_id: workspaceId, target_type: targetType, target_id: targetId, emoji }),
      })
    } catch {
      // revert on error
      setLocal(reactions)
    } finally {
      setBusy(null)
    }

    onUpdate?.(local)
  }

  const active = EMOJIS.filter((e) => counts[e] > 0)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map((emoji) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji as Emoji)}
          disabled={!!busy}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            hasReacted(emoji)
              ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
              : 'bg-navy-800/50 border-navy-700 text-slate-400 hover:border-navy-500'
          }`}
        >
          <span>{emoji}</span>
          <span className="font-medium">{counts[emoji]}</span>
        </button>
      ))}
      <div className="relative group">
        <button className="px-2 py-0.5 rounded-full text-xs border border-dashed border-navy-700 text-slate-500 hover:border-navy-500 hover:text-slate-400 transition-colors">
          +
        </button>
        <div className="absolute bottom-7 left-0 bg-navy-800 border border-navy-700 rounded-xl p-1.5 hidden group-hover:flex gap-0.5 shadow-xl z-10">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => toggle(e)}
              className="text-lg px-1.5 py-1 hover:bg-navy-700 rounded-lg transition-colors"
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
