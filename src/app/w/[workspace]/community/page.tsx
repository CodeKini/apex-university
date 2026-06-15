'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }        from '@/lib/workspace/context'
import PostCard, { Post }      from '@/components/community/PostCard'
import PostComposer            from '@/components/community/PostComposer'
import { Loader2 }             from 'lucide-react'

export default function CommunityFeedPage() {
  const { workspace }  = useWorkspace()
  const { workspace: slug } = useParams<{ workspace: string }>()
  const supabase       = createClientComponentClient()

  const [userId,    setUserId]    = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [posts,     setPosts]     = useState<Post[]>([])
  const [loading,   setLoading]   = useState(true)
  const [page,      setPage]      = useState(1)
  const [total,     setTotal]     = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      const { data: m } = await (supabase as any)
        .from('workspace_members').select('role')
        .eq('workspace_id', workspace.id).eq('user_id', session.user.id).maybeSingle()
      setIsManager(m?.role === 'owner' || m?.role === 'admin')

      await fetchPosts(1)
    }
    init()
  }, [workspace.id])

  async function fetchPosts(p: number) {
    setLoading(true)
    const res  = await fetch(`/api/community/posts?workspaceId=${workspace.id}&page=${p}&limit=20`)
    const data = await res.json()
    if (p === 1) setPosts(data.posts ?? [])
    else setPosts((prev) => [...prev, ...(data.posts ?? [])])
    setTotal(data.total ?? 0)
    setPage(p)
    setLoading(false)
  }

  function handleCreated(post: Post) {
    setPosts((prev) => [{ ...post, reactions: [], comments: [] }, ...prev])
  }

  function handleDelete(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  return (
    <div className="space-y-4">
      <PostComposer
        workspaceId={workspace.id}
        isManager={isManager}
        onCreated={handleCreated}
        placeholder="Share something with the community…"
      />

      {loading && posts.length === 0 ? (
        <div className="py-12 flex justify-center text-slate-500">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 text-sm">
          No posts yet. Be the first to share something!
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              workspaceSlug={slug}
              workspaceId={workspace.id}
              currentUserId={userId ?? ''}
              isManager={isManager}
              onDelete={handleDelete}
            />
          ))}

          {posts.length < total && (
            <button
              onClick={() => fetchPosts(page + 1)}
              disabled={loading}
              className="w-full py-2.5 text-sm text-slate-400 hover:text-white border border-navy-700 rounded-xl transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
