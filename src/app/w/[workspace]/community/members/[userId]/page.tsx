'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }        from '@/lib/workspace/context'
import { ArrowLeft, Loader2, Twitter, Globe, Linkedin, BookOpen, Edit3, Save } from 'lucide-react'

export default function MemberProfilePage() {
  const { workspace: slug, userId: profileUserId } = useParams<{ workspace: string; userId: string }>()
  const { workspace } = useWorkspace()
  const supabase      = createClientComponentClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [data,     setData]     = useState<any>(null)
  const [editing,  setEditing]  = useState(false)
  const [bio,      setBio]      = useState('')
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setCurrentUserId(session.user.id)

      const res = await fetch(`/api/community/profiles/${profileUserId}?workspaceId=${workspace.id}`)
      const d   = await res.json()
      setData(d)
      setBio(d.profile?.bio ?? '')
      setLoading(false)
    }
    init()
  }, [profileUserId, workspace.id])

  async function saveProfile() {
    setSaving(true)
    await fetch(`/api/community/profiles/${profileUserId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspace_id: workspace.id, bio }),
    })
    setData((prev: any) => ({ ...prev, profile: { ...prev.profile, bio } }))
    setSaving(false)
    setEditing(false)
  }

  async function startDm() {
    const res  = await fetch('/api/community/dm/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspace_id: workspace.id, recipient_id: profileUserId }),
    })
    const d = await res.json()
    if (res.ok) window.location.href = `/w/${slug}/community/messages?conv=${d.conversationId}`
  }

  if (loading) return (
    <div className="py-12 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={20} /></div>
  )
  if (!data?.user) return (
    <div className="text-center py-12 text-slate-500">Member not found.</div>
  )

  const { user, profile, enrollmentCount } = data
  const isOwn = currentUserId === profileUserId
  const links: Record<string, string> = profile?.social_links ?? {}

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href={`/w/${slug}/community/members`}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
        <ArrowLeft size={14} /> Back to members
      </Link>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-navy-700 flex items-center justify-center text-2xl font-bold text-slate-300 shrink-0">
            {user.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{user.full_name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
            <p className="text-xs text-slate-500 mt-1">
              Joined {new Date(user.created_at).toLocaleDateString()} · {enrollmentCount} course{enrollmentCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwn && (
              <button
                onClick={() => editing ? saveProfile() : setEditing(true)}
                disabled={saving}
                className="btn-ghost text-xs flex items-center gap-1.5"
              >
                {saving
                  ? <Loader2 size={12} className="animate-spin" />
                  : editing ? <Save size={12} /> : <Edit3 size={12} />}
                {editing ? 'Save' : 'Edit profile'}
              </button>
            )}
            {!isOwn && currentUserId && (
              <button onClick={startDm} className="btn-primary text-xs">
                Message
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="mt-5">
          {editing ? (
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="Tell the community about yourself…"
              className="input-field resize-none text-sm w-full"
            />
          ) : (
            <p className="text-slate-400 text-sm leading-relaxed">
              {profile?.bio ?? (isOwn ? 'Add a bio to introduce yourself to the community.' : 'No bio yet.')}
            </p>
          )}
          {editing && (
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300 mt-2">
              Cancel
            </button>
          )}
        </div>

        {/* Social links */}
        {Object.keys(links).length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            {links.twitter && (
              <a href={links.twitter} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 hover:text-sky-400 transition-colors">
                <Twitter size={16} />
              </a>
            )}
            {links.linkedin && (
              <a href={links.linkedin} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 hover:text-blue-400 transition-colors">
                <Linkedin size={16} />
              </a>
            )}
            {links.website && (
              <a href={links.website} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors">
                <Globe size={16} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
