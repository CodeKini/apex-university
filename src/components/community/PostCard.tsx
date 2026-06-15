'use client'

import { useState }  from 'react'
import Link          from 'next/link'
import ReactionBar   from './ReactionBar'
import { Pin, Lock, Megaphone, HelpCircle, MessageSquare, Trash2, MoreHorizontal } from 'lucide-react'

export interface Post {
  id:         string
  post_type:  string
  title?:     string
  body:       string
  is_pinned:  boolean
  is_locked:  boolean
  created_at: string
  author:     { id: string; full_name: string; email: string }
  reactions:  { emoji: string; user_id: string }[]
  comments:   { id: string }[]
}

interface Props {
  post:          Post
  workspaceSlug: string
  workspaceId:   string
  currentUserId: string
  isManager?:    boolean
  onDelete?:     (postId: string) => void
}

const TYPE_BADGE: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  announcement: { label: 'Announcement', icon: Megaphone,     color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
  question:     { label: 'Question',     icon: HelpCircle,    color: 'text-blue-400  bg-blue-500/10  border-blue-500/20' },
  post:         { label: 'Post',         icon: MessageSquare, color: 'text-slate-400 bg-navy-800     border-navy-700'    },
  lesson_comment: { label: 'Comment',   icon: MessageSquare, color: 'text-slate-400 bg-navy-800     border-navy-700'    },
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function PostCard({ post, workspaceSlug, workspaceId, currentUserId, isManager, onDelete }: Props) {
  const [menuOpen, setMenuOpen]       = useState(false)
  const [reactions, setReactions]     = useState(post.reactions)
  const [deleting,  setDeleting]      = useState(false)

  const badge   = TYPE_BADGE[post.post_type] ?? TYPE_BADGE.post
  const BadgeIcon = badge.icon

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' })
    onDelete?.(post.id)
  }

  async function handleMod(action: string) {
    setMenuOpen(false)
    await fetch(`/api/community/moderation/posts/${post.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    window.location.reload()
  }

  const canDelete = currentUserId === post.author.id || isManager
  const isOwn     = currentUserId === post.author.id

  return (
    <div className={`card p-5 ${deleting ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
            {post.author.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{post.author.full_name}</div>
            <div className="text-xs text-slate-500">{timeAgo(post.created_at)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {post.is_pinned && <Pin size={13} className="text-gold-400" />}
          {post.is_locked && <Lock size={13} className="text-slate-500" />}
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>
            <BadgeIcon size={11} />
            {badge.label}
          </span>
          {(canDelete || isManager) && (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors">
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 bg-navy-800 border border-navy-700 rounded-xl shadow-xl z-20 w-40 py-1 text-sm">
                  {isManager && (
                    <>
                      <button onClick={() => handleMod(post.is_pinned ? 'unpin' : 'pin')}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-navy-700">
                        {post.is_pinned ? 'Unpin' : 'Pin post'}
                      </button>
                      <button onClick={() => handleMod(post.is_locked ? 'unlock' : 'lock')}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-navy-700">
                        {post.is_locked ? 'Unlock' : 'Lock post'}
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button onClick={handleDelete}
                      className="w-full text-left px-3 py-2 text-red-400 hover:bg-navy-700 flex items-center gap-2">
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {post.title && (
        <h3 className="font-semibold text-white mb-1.5">{post.title}</h3>
      )}
      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {post.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-navy-800">
        <ReactionBar
          targetType="post"
          targetId={post.id}
          workspaceId={workspaceId}
          reactions={reactions}
          currentUserId={currentUserId}
          onUpdate={setReactions}
        />
        <Link
          href={`/w/${workspaceSlug}/community/post/${post.id}`}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <MessageSquare size={13} />
          {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
        </Link>
      </div>
    </div>
  )
}
