'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }        from '@/lib/workspace/context'
import ReactionBar             from '@/components/community/ReactionBar'
import CommentThread           from '@/components/community/CommentThread'
import { ArrowLeft, Loader2, Pin, Lock, Megaphone, HelpCircle, MessageSquare } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  announcement:  'Announcement',
  question:      'Question',
  post:          'Post',
  lesson_comment: 'Lesson Comment',
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function PostDetailPage() {
  const { workspace: slug, postId } = useParams<{ workspace: string; postId: string }>()
  const { workspace } = useWorkspace()
  const supabase = createClientComponentClient()

  const [userId,    setUserId]    = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [post,      setPost]      = useState<any>(null)
  const [comments,  setComments]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      const { data: m } = await (supabase as any)
        .from('workspace_members').select('role')
        .eq('workspace_id', workspace.id).eq('user_id', session.user.id).maybeSingle()
      setIsManager(m?.role === 'owner' || m?.role === 'admin')

      const [postRes, commentsRes] = await Promise.all([
        fetch(`/api/community/posts/${postId}`),
        fetch(`/api/community/posts/${postId}/comments`),
      ])
      const [postData, commentsData] = await Promise.all([postRes.json(), commentsRes.json()])
      setPost(postData.post)
      setComments(commentsData.comments ?? [])
      setLoading(false)
    }
    init()
  }, [postId, workspace.id])

  if (loading) return (
    <div className="py-12 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>
  )
  if (!post) return (
    <div className="text-center py-12 text-slate-500">Post not found.</div>
  )

  return (
    <div className="space-y-6">
      <Link href={`/w/${slug}/community`}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        <ArrowLeft size={14} /> Back to feed
      </Link>

      {/* Post */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-bold text-slate-300">
            {post.author?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div className="font-medium text-white text-sm">{post.author?.full_name}</div>
            <div className="text-xs text-slate-500">{timeAgo(post.created_at)}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {post.is_pinned && <Pin size={13} className="text-gold-400" />}
            {post.is_locked && <Lock size={13} className="text-slate-500" />}
            <span className="text-xs text-slate-500 bg-navy-800 px-2 py-0.5 rounded-full border border-navy-700">
              {TYPE_LABEL[post.post_type] ?? 'Post'}
            </span>
          </div>
        </div>

        {post.title && <h1 className="text-xl font-bold text-white mb-3">{post.title}</h1>}
        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>

        <div className="mt-5 pt-4 border-t border-navy-800">
          <ReactionBar
            targetType="post"
            targetId={post.id}
            workspaceId={workspace.id}
            reactions={post.reactions ?? []}
            currentUserId={userId ?? ''}
          />
        </div>
      </div>

      {/* Comments */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-5 text-sm">
          Comments ({comments.length})
        </h2>
        <CommentThread
          postId={post.id}
          workspaceId={workspace.id}
          isLocked={post.is_locked}
          comments={comments}
          currentUserId={userId ?? ''}
          isManager={isManager}
        />
      </div>
    </div>
  )
}
