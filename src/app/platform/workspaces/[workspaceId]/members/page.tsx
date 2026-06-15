'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams }   from 'next/navigation'
import { useToast }    from '@/hooks/useToast'
import { ToastStack }  from '@/components/ui/ToastStack'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'moderator' | 'member'

interface Member {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  joined_at: string
  last_seen_at: string | null
  enrolled_course_count: number
}

interface Enrollment {
  id: string
  course_id: string
  access_status: string
  source: string
  created_at: string
  courses: {
    id: string
    title: string
    slug: string
    thumbnail_url: string | null
    price: number
    is_free: boolean
  } | null
  progress: { completed: number; total: number; pct: number }
}

interface Course {
  id: string
  title: string
  slug: string
  status: string
  is_free: boolean
  price: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_ORDER: Role[] = ['owner', 'admin', 'moderator', 'member']
const ROLE_COLORS: Record<Role, string> = {
  owner:     'bg-purple-100 text-purple-800',
  admin:     'bg-blue-100 text-blue-800',
  moderator: 'bg-green-100 text-green-800',
  member:    'bg-gray-100 text-gray-700',
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name, url, size = 8 }: { name: string | null; url: string | null; size?: number }) {
  if (url) return <img src={url} alt="" className={`w-${size} h-${size} rounded-full object-cover`} />
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-${size} h-${size} rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold`}>
      {initials}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { toasts, show, dismiss } = useToast()

  const [members, setMembers]           = useState<Member[]>([])
  const [callerRole, setCallerRole]     = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [roleFilter, setRoleFilter]     = useState<Role | 'all'>('all')
  const [selectedMember, setSelected]   = useState<Member | null>(null)
  const [drawerOpen, setDrawerOpen]     = useState(false)

  // Enrollment modal
  const [enrollModalOpen, setEnrollModal] = useState(false)
  const [enrollTarget, setEnrollTarget]   = useState<Member | null>(null)
  const [courses, setCourses]             = useState<Course[]>([])
  const [enrollCourseId, setEnrollCourseId] = useState('')
  const [enrolling, setEnrolling]         = useState(false)

  // Drawer state
  const [drawerEnrollments, setDrawerEnrollments] = useState<Enrollment[]>([])
  const [drawerLoading, setDrawerLoading]          = useState(false)

  // Role change state
  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({})
  const [savingRole, setSavingRole]   = useState<string | null>(null)

  // Remove member state
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null)
  const [removing, setRemoving]           = useState(false)

  const canManage = callerRole === 'platform_admin' || callerRole === 'owner' || callerRole === 'admin'

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/members?workspaceId=${workspaceId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load members')
      setMembers(json.members ?? [])
      setCallerRole(json.callerRole ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { loadMembers() }, [loadMembers])

  const openDrawer = async (member: Member) => {
    setSelected(member)
    setDrawerOpen(true)
    setDrawerEnrollments([])
    setDrawerLoading(true)
    try {
      const res = await fetch(`/api/platform/members/${member.id}/enrollments?workspaceId=${workspaceId}`)
      const json = await res.json()
      setDrawerEnrollments(json.enrollments ?? [])
    } catch {}
    finally { setDrawerLoading(false) }
  }

  const loadCourses = async () => {
    const res = await fetch(`/api/platform/courses?workspaceId=${workspaceId}&status=published`)
    const json = await res.json()
    setCourses(json.courses ?? [])
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const saveRole = async (member: Member) => {
    const newRole = pendingRole[member.id]
    if (!newRole || newRole === member.role) return
    setSavingRole(member.id)
    try {
      const res = await fetch(`/api/platform/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, role: newRole }),
      })
      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
        setPendingRole(prev => { const n = { ...prev }; delete n[member.id]; return n })
        show('Role updated.', 'success')
      } else {
        const j = await res.json()
        show(j.error ?? 'Failed to update role', 'error')
      }
    } finally { setSavingRole(null) }
  }

  const removeMember = async () => {
    if (!confirmRemove) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/platform/members/${confirmRemove.id}?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== confirmRemove.id))
        setConfirmRemove(null)
        show('Member removed.', 'success')
        if (selectedMember?.id === confirmRemove.id) setDrawerOpen(false)
      } else {
        const j = await res.json()
        show(j.error ?? 'Failed to remove member', 'error')
      }
    } finally { setRemoving(false) }
  }

  const revokeEnrollment = async (enrollment: Enrollment) => {
    if (!selectedMember) return
    const res = await fetch('/api/platform/enrollments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id:   workspaceId,
        course_id:      enrollment.course_id,
        target_user_id: selectedMember.user_id,
      }),
    })
    if (res.ok) {
      setDrawerEnrollments(prev => prev.map(e =>
        e.id === enrollment.id ? { ...e, access_status: 'revoked' } : e
      ))
      setMembers(prev => prev.map(m =>
        m.id === selectedMember.id
          ? { ...m, enrolled_course_count: Math.max(0, m.enrolled_course_count - 1) }
          : m
      ))
      show('Access revoked.', 'success')
    } else {
      const j = await res.json()
      show(j.error ?? 'Failed to revoke access', 'error')
    }
  }

  const openEnrollModal = (member: Member) => {
    setEnrollTarget(member)
    setEnrollCourseId('')
    setEnrollModal(true)
    loadCourses()
  }

  const submitEnrollment = async () => {
    if (!enrollTarget || !enrollCourseId) return
    setEnrolling(true)
    try {
      const res = await fetch('/api/platform/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id:   workspaceId,
          course_id:      enrollCourseId,
          target_user_id: enrollTarget.user_id,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        if (!json.already_enrolled) {
          setMembers(prev => prev.map(m =>
            m.id === enrollTarget.id
              ? { ...m, enrolled_course_count: m.enrolled_course_count + 1 }
              : m
          ))
        }
        setEnrollModal(false)
        show(json.already_enrolled ? 'Already enrolled.' : 'Member enrolled successfully.', 'success')
        // Refresh drawer if it's open for this member
        if (drawerOpen && selectedMember?.id === enrollTarget.id) {
          openDrawer(selectedMember)
        }
      } else {
        show(json.error ?? 'Failed to enroll member', 'error')
      }
    } finally { setEnrolling(false) }
  }

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || (m.email?.toLowerCase().includes(q) || (m.full_name?.toLowerCase().includes(q) ?? false))
    const matchRole = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading members…</div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">{error}</div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} total</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1">
          {(['all', ...ROLE_ORDER] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r as any)}
              className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Seen</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Courses</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">No members found</td>
              </tr>
            )}
            {filtered.map(member => {
              const currentRole = pendingRole[member.id] ?? member.role
              const isDirty = pendingRole[member.id] && pendingRole[member.id] !== member.role
              return (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      className="flex items-center gap-3 text-left"
                      onClick={() => openDrawer(member)}
                    >
                      <Avatar name={member.full_name} url={member.avatar_url} />
                      <div>
                        <div className="font-medium text-gray-900">{member.full_name ?? '—'}</div>
                        <div className="text-gray-500 text-xs">{member.email}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && member.role !== 'owner' ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={currentRole}
                          onChange={e => setPendingRole(prev => ({ ...prev, [member.id]: e.target.value as Role }))}
                          className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {ROLE_ORDER.filter(r => r !== 'owner').map(r => (
                            <option key={r} value={r} className="capitalize">{r}</option>
                          ))}
                        </select>
                        {isDirty && (
                          <button
                            onClick={() => saveRole(member)}
                            disabled={savingRole === member.id}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {savingRole === member.id ? '…' : 'Save'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[member.role]}`}>
                        {member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmt(member.joined_at)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(member.last_seen_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <span className="font-medium">{member.enrolled_course_count}</span>
                      <span className="text-gray-400 text-xs">enrolled</span>
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEnrollModal(member)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          + Enroll
                        </button>
                        {member.role !== 'owner' && (
                          <button
                            onClick={() => setConfirmRemove(member)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Member Detail Drawer ── */}
      {drawerOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)} />

          {/* Panel */}
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Avatar name={selectedMember.full_name} url={selectedMember.avatar_url} size={10} />
                <div>
                  <div className="font-semibold text-gray-900">{selectedMember.full_name ?? '—'}</div>
                  <div className="text-xs text-gray-500">{selectedMember.email}</div>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 text-sm text-gray-600 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Role</div>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[selectedMember.role]}`}>
                  {selectedMember.role}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Joined</div>
                <div>{fmt(selectedMember.joined_at)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Last Seen</div>
                <div>{fmt(selectedMember.last_seen_at)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Enrolled Courses</div>
                <div className="font-medium">{selectedMember.enrolled_course_count}</div>
              </div>
            </div>

            <div className="flex-1 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Enrollments</h3>
                {canManage && (
                  <button
                    onClick={() => openEnrollModal(selectedMember)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    + Enroll in course
                  </button>
                )}
              </div>

              {drawerLoading ? (
                <div className="text-sm text-gray-400">Loading…</div>
              ) : drawerEnrollments.length === 0 ? (
                <div className="text-sm text-gray-400">No enrollments yet.</div>
              ) : (
                <div className="space-y-3">
                  {drawerEnrollments.map(enrollment => (
                    <div key={enrollment.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {enrollment.courses?.title ?? 'Unknown course'}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {enrollment.source} · {fmt(enrollment.created_at)}
                          </div>
                          {enrollment.access_status !== 'active' && (
                            <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full capitalize">
                              {enrollment.access_status}
                            </span>
                          )}
                        </div>
                        {canManage && enrollment.access_status === 'active' && (
                          <button
                            onClick={() => revokeEnrollment(enrollment)}
                            className="text-xs text-red-500 hover:underline shrink-0"
                          >
                            Revoke
                          </button>
                        )}
                      </div>

                      {/* Progress bar */}
                      {enrollment.progress.total > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{enrollment.progress.completed}/{enrollment.progress.total} lessons</span>
                            <span>{enrollment.progress.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${enrollment.progress.pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && selectedMember.role !== 'owner' && (
              <div className="px-5 py-4 border-t border-gray-100">
                <button
                  onClick={() => setConfirmRemove(selectedMember)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove from workspace
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Enrollment Modal ── */}
      {enrollModalOpen && enrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Enroll Member</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enrolling <strong>{enrollTarget.full_name ?? enrollTarget.email}</strong> in a course.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Select course</label>
            <select
              value={enrollCourseId}
              onChange={e => setEnrollCourseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value="">— Choose a course —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.is_free ? '(free)' : `($${(c.price / 100).toFixed(2)})`}
                </option>
              ))}
            </select>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEnrollModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={submitEnrollment}
                disabled={!enrollCourseId || enrolling}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {enrolling ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Confirm Modal ── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove member?</h2>
            <p className="text-sm text-gray-600 mb-5">
              Remove <strong>{confirmRemove.full_name ?? confirmRemove.email}</strong> from this workspace?
              Their enrollments and progress will be kept but they will lose workspace access.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={removeMember}
                disabled={removing}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
