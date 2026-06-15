'use client'

import { useState } from 'react'
import { Loader2, Send, ChevronDown } from 'lucide-react'

type PostType = 'post' | 'question' | 'announcement'

interface Props {
  workspaceId:  string
  courseId?:    string
  lessonId?:    string
  isManager?:   boolean
  placeholder?: string
  onCreated?:   (post: any) => void
}

export default function PostComposer({
  workspaceId, courseId, lessonId, isManager, placeholder, onCreated,
}: Props) {
  const [open,       setOpen]      = useState(false)
  const [body,       setBody]      = useState('')
  const [title,      setTitle]     = useState('')
  const [postType,   setPostType]  = useState<PostType>('post')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]     = useState<string | null>(null)

  const isLesson = !!lessonId

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/community/posts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        workspace_id: workspaceId,
        post_type:    isLesson ? 'lesson_comment' : postType,
        course_id:    courseId,
        lesson_id:    lessonId,
        title:        title.trim() || undefined,
        body:         body.trim(),
      }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(data.error ?? 'Failed to post.'); return }

    setBody(''); setTitle(''); setOpen(false)
    onCreated?.(data.post)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left px-4 py-3 card text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        {placeholder ?? 'Share something with the community…'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      {!isLesson && (
        <div className="flex items-center justify-between">
          <div className="relative">
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as PostType)}
              className="input-field text-sm py-1.5 pr-8 appearance-none"
            >
              <option value="post">Post</option>
              <option value="question">Question</option>
              {isManager && <option value="announcement">Announcement</option>}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300">
            Cancel
          </button>
        </div>
      )}

      {!isLesson && (postType === 'post' || postType === 'announcement') && (
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="input-field text-sm"
        />
      )}

      <textarea
        rows={isLesson ? 3 : 5}
        placeholder={isLesson ? 'Ask a question or share a note about this lesson…' : 'What\'s on your mind?'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={10000}
        className="input-field resize-none text-sm w-full"
        autoFocus
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-between">
        {isLesson && (
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="btn-primary text-sm flex items-center gap-2 ml-auto"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isLesson ? 'Comment' : 'Post'}
        </button>
      </div>
    </form>
  )
}
