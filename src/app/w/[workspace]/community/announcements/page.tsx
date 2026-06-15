'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }        from '@/lib/workspace/context'
import PostCard, { Post }      from '@/components/community/PostCard'
import PostComposer            from '@/components/community/PostComposer'
import { Loader2, Megaphone }  from 'lucide-react'

export default function AnnouncementsPage() {
  const { workspace: slug } = useParams<{ workspace: string }>()
  const { workspace }       = useWorkspace()
  const supabase            = createClientComponentClient()

  const [userId,    setUserId]    = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [posts,     setPosts]     = useState<Post[]>([])
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

      const res  = await fetch(`/api/community/posts?workspaceId=${workspace.id}&type=announcement&limit=50`)
      const data = await res.json()
      setPosts(data.posts ?? [])
      setLoading(false)
    }
    init()
  }, [workspace.id])

  return (
    <div className="space-y-4">
      {isManager && (
        <PostComposer
          workspaceId={workspace.id}
          isManager={isManager}
          placeholder="Post an announcement to all members…"
          onCreated={(post) => setPosts((prev) => [{ ...post, reactions: [], comments: [] }, ...prev])}
        />
      )}

      {loading ? (
        <div className="py-12 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center">
          <Megaphone className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No announcements yet.</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            workspaceSlug={slug}
            workspaceId={workspace.id}
            currentUserId={userId ?? ''}
            isManager={isManager}
            onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          />
        ))
      )}
    </div>
  )
}
