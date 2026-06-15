'use client'

import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { useParams }           from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }        from '@/lib/workspace/context'
import { Loader2, Search, Users } from 'lucide-react'

interface Member {
  user_id:   string
  role:      string
  joined_at: string
  user:      { id: string; full_name: string; email: string }
}

export default function MembersPage() {
  const { workspace: slug } = useParams<{ workspace: string }>()
  const { workspace }       = useWorkspace()
  const supabase            = createClientComponentClient()

  const [members,  setMembers]  = useState<Member[]>([])
  const [filtered, setFiltered] = useState<Member[]>([])
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [userId,   setUserId]   = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setUserId(session.user.id)

      const { data } = await (supabase as any)
        .from('workspace_members')
        .select('user_id, role, joined_at, user:platform_users!user_id(id, full_name, email)')
        .eq('workspace_id', workspace.id)
        .order('joined_at', { ascending: true })

      setMembers(data ?? [])
      setFiltered(data ?? [])
      setLoading(false)
    }
    init()
  }, [workspace.id])

  useEffect(() => {
    if (!query.trim()) { setFiltered(members); return }
    const q = query.toLowerCase()
    setFiltered(members.filter((m) =>
      m.user?.full_name?.toLowerCase().includes(q) || m.user?.email?.toLowerCase().includes(q)
    ))
  }, [query, members])

  async function startDm(recipientId: string) {
    const res  = await fetch('/api/community/dm/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspace_id: workspace.id, recipient_id: recipientId }),
    })
    const data = await res.json()
    if (res.ok) {
      window.location.href = `/w/${slug}/community/messages?conv=${data.conversationId}`
    }
  }

  const roleLabel: Record<string, string> = {
    owner: 'Owner', admin: 'Admin', member: 'Member',
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field pl-8 text-sm"
        />
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No members found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.user_id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center text-sm font-bold text-slate-300 shrink-0">
                {m.user?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm">{m.user?.full_name}</div>
                <div className="text-xs text-slate-500">{m.user?.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.role !== 'member' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    m.role === 'owner'
                      ? 'text-gold-400 bg-gold-500/10 border-gold-500/20'
                      : 'text-slate-400 bg-navy-800 border-navy-700'
                  }`}>
                    {roleLabel[m.role] ?? m.role}
                  </span>
                )}
                <Link href={`/w/${slug}/community/members/${m.user_id}`}
                  className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-navy-700 hover:border-navy-500">
                  View
                </Link>
                {userId && m.user_id !== userId && (
                  <button
                    onClick={() => startDm(m.user_id)}
                    className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-navy-700 hover:border-navy-500"
                  >
                    Message
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
