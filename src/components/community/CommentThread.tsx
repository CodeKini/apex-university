'use client'

import { useState }  from 'react'
import ReactionBar   from './ReactionBar'
import { Loader2, CornerDownRight, Trash2 } from 'lucide-react'

interface Comment {
  id:         string
  body:       string
  parent_id:  string | null
  created_at: string
  author:     { id: string; full_name: string; email: string }
  reactions:  { emoji: string; user_id: string }[]
}

interface Props {
  postId:        string
  workspaceId:   string
  isLocked?:     boolean
  comments:      Comment[]
  currentUserId: string
  isManager?:    boolean
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function CommentItem({
  comment, postId, workspaceId, currentUserId, isManager, isLocked,
  onDelete, onReply,
}: {
  comment:       Comment
  postId:        string
  workspaceId:   string
  currentUserId: string
  isManager?:    boolean
  isLocked?:     boolean
  onDelete:      (id: string) => void
  onReply:       (id: string, name: string) => void
}) {
  const [reactions, setReactions] = useState(comment.reactions)

  async function handleDelete() {
    if (!confirm('Delete this comment?')) return
    await fetch(`/api/community/posts/${postId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: comment.id }),
    })
    onDelete(comment.id)
  }

  const canDelete = currentUserId === comment.author.id || isManager

  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 mt-0.5">
        {comment.author.full_name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white">{comment.author.full_name}</span>
          <span className="text-xs text-slate-500">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm text-slate-300 mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
        <div className="flex items-center gap-3 mt-2">
          <ReactionBar
            targetType="comment"
            targetId={comment.id}
            workspaceId={workspaceId}
            reactions={reactions}
            currentUserId={currentUserId}
            onUpdate={setReactions}
          />
          {!isLocked && (
            <button
              onClick={() => onReply(comment.id, comment.author.full_name)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reply
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CommentThread({
  postId, workspaceId, isLocked, comments: initialComments, currentUserId, isManager,
}: Props) {
  const [comments,   setComments]   = useState<Comment[]>(initialComments)
  const [replyTo,    setReplyTo]    = useState<{ id: string; name: string } | null>(null)
  const [input,      setInput]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Separate top-level from replies
  const topLevel = comments.filter((c) => !c.parent_id)
  const replies  = comments.filter((c) => !!c.parent_id)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/community/posts/${postId}/comments`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ body: input.trim(), parent_id: replyTo?.id }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(data.error ?? 'Failed to post.'); return }

    setComments((prev) => [...prev, { ...data.comment, reactions: [] }])
    setInput('')
    setReplyTo(null)
  }

  function removeComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Comment list */}
      <div className="space-y-5">
        {topLevel.map((c) => (
          <div key={c.id}>
            <CommentItem
              comment={c}
              postId={postId}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              isManager={isManager}
              isLocked={isLocked}
              onDelete={removeComment}
              onReply={(id, name) => setReplyTo({ id, name })}
            />
            {/* Replies */}
            {replies.filter((r) => r.parent_id === c.id).map((r) => (
              <div key={r.id} className="ml-9 mt-3 flex gap-1 text-slate-500">
                <CornerDownRight size={13} className="mt-1 shrink-0" />
                <div className="flex-1">
                  <CommentItem
                    comment={r}
                    postId={postId}
                    workspaceId={workspaceId}
                    currentUserId={currentUserId}
                    isManager={isManager}
                    isLocked={isLocked}
                    onDelete={removeComment}
                    onReply={() => setReplyTo({ id: c.id, name: c.author.full_name })}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No comments yet. Be the first!</p>
        )}
      </div>

      {/* Composer */}
      {!isLocked && (
        <form onSubmit={submit} className="pt-2 border-t border-navy-800">
          {replyTo && (
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
              Replying to <span className="text-slate-300 font-medium">{replyTo.name}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-slate-600 hover:text-slate-400">
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              rows={2}
              placeholder="Write a comment…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={5000}
              className="input-field resize-none text-sm flex-1"
            />
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className="btn-primary text-sm self-end px-3"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </form>
      )}
      {isLocked && (
        <p className="text-xs text-slate-500 text-center pt-2 border-t border-navy-800">
          This post is locked. Comments are disabled.
        </p>
      )}
    </div>
  )
}
