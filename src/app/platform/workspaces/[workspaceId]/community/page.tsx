'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import {
  Pin, Lock, Trash2, RefreshCw, Megaphone, HelpCircle,
  MessageSquare, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'

interface Post {
  id:         string
  post_type:  string
  title?:     string
  body:       string
  is_pinned:  boolean
  is_locked:  boolean
  is_deleted: boolean
  created_at: string
  author:     { id: string; full_name: string; email: string }
  reactions:  any[]
  comments:   any[]
}

const TYPE_ICON: Record<string, React.ElementType> = {
  announcement: Megaphone,
  question:     HelpCircle,
  post:         MessageSquare,
  lesson_comment: MessageSquare,
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function WorkspaceCommunityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'pinned' | 'locked'>('all')
  const [acting,  setActing]  = useState<string | null>(null)

  useEffect(() => { load() }, [workspaceId])

  async function load() {
    setLoading(true)
    const res  = await fetch(`/api/community/posts?workspaceId=${workspaceId}&limit=50`)
    const data = await res.json()
    setPosts(data.posts ?? [])
    setLoading(false)
  }

  async function moderate(postId: string, action: string) {
    setActing(postId)
    await fetch(`/api/community/moderation/posts/${postId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    setActing(null)
    await load()
  }

  const filtered = posts.filter((p) => {
    if (filter === 'pinned') return p.is_pinned
    if (filter === 'locked') return p.is_locked
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Community Moderation</h1>
          <p className="text-slate-400 text-sm mt-1">Manage posts, pin announcements, lock or remove content.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-navy-700 rounded-lg text-slate-400 hover:text-white hover:border-navy-500 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(['all', 'pinned', 'locked'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
              filter === f
                ? 'bg-navy-700 border-navy-600 text-white'
                : 'border-navy-700 text-slate-400 hover:text-white hover:border-navy-600'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 self-center">{filtered.length} posts</span>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 text-sm">No posts to moderate.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-navy-700">
              <tr>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Post</th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Author</th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Stats</th>
                <th className="text-right px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {filtered.map((post) => {
                const Icon = TYPE_ICON[post.post_type] ?? MessageSquare
                const isBusy = acting === post.id
                return (
                  <tr key={post.id} className="hover:bg-navy-800/30 transition-colors">
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex items-start gap-2">
                        <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          {post.title && <div className="font-medium text-white text-xs mb-0.5 truncate">{post.title}</div>}
                          <div className="text-slate-400 text-xs line-clamp-2">{post.body}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {post.is_pinned && <span className="text-[10px] text-gold-400 flex items-center gap-0.5"><Pin size={9} /> Pinned</span>}
                            {post.is_locked && <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><Lock size={9} /> Locked</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-slate-300 text-xs">{post.author?.full_name}</div>
                      <div className="text-slate-500 text-xs">{timeAgo(post.created_at)}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      <div>{post.comments?.length ?? 0} comments</div>
                      <div>{post.reactions?.length ?? 0} reactions</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {isBusy ? (
                          <Loader2 size={14} className="animate-spin text-slate-500" />
                        ) : (
                          <>
                            <button
                              onClick={() => moderate(post.id, post.is_pinned ? 'unpin' : 'pin')}
                              title={post.is_pinned ? 'Unpin' : 'Pin'}
                              className={`p-1.5 rounded transition-colors ${
                                post.is_pinned ? 'text-gold-400 hover:text-gold-300' : 'text-slate-500 hover:text-gold-400'
                              }`}
                            >
                              <Pin size={13} />
                            </button>
                            <button
                              onClick={() => moderate(post.id, post.is_locked ? 'unlock' : 'lock')}
                              title={post.is_locked ? 'Unlock' : 'Lock'}
                              className="p-1.5 rounded text-slate-500 hover:text-amber-400 transition-colors"
                            >
                              <Lock size={13} />
                            </button>
                            <button
                              onClick={() => moderate(post.id, 'delete')}
                              title="Delete"
                              className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
