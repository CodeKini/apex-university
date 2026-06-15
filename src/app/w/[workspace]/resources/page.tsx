'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace } from '@/lib/workspace/context'
import {
  FileText, File, Image, Music, Video, Link2, ExternalLink,
  Download, Lock, Loader2, Search, Filter,
} from 'lucide-react'

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf:          FileText,
  zip:          File,
  image:        Image,
  audio:        Music,
  video_link:   Video,
  canva_link:   Link2,
  google_link:  Link2,
  external_url: ExternalLink,
  file:         File,
}

const TYPE_LABELS: Record<string, string> = {
  pdf:          'PDF',
  zip:          'ZIP',
  image:        'Image',
  audio:        'Audio',
  video_link:   'Video',
  canva_link:   'Canva',
  google_link:  'Google Doc',
  external_url: 'Link',
  file:         'File',
}

const ACCESS_LABELS: Record<string, string> = {
  free:             'Free',
  paid_course:      'Paid Students',
  membership:       'Members Only',
  specific_courses: 'Course Students',
  specific_paths:   'Path Students',
}

interface Resource {
  id: string
  title: string
  description: string | null
  resource_type: string
  file_name: string | null
  file_size: number | null
  external_url: string | null
  access_type: string
  download_count: number
  accessible: boolean
  created_at: string
}

export default function StudentResourceLibraryPage() {
  const params   = useParams()
  const router   = useRouter()
  const workSlug = params.workspace as string
  const { workspace } = useWorkspace()
  const supabase = createClientComponentClient()

  const [resources,   setResources]   = useState<Resource[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/w/${workSlug}/auth/login`); return }

    const res = await fetch(`/api/student/resources?workspaceId=${workspace.id}`)
    const data = await res.json()
    setResources(data.resources ?? [])
    setLoading(false)
  }, [workspace.id, workSlug])

  useEffect(() => { fetchData() }, [fetchData])

  const download = async (resource: Resource) => {
    if (!resource.accessible) return
    setDownloading(resource.id)
    try {
      const res  = await fetch(`/api/student/resources/${resource.id}/download?workspaceId=${workspace.id}`)
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Access denied'); return }

      if (data.type === 'external') {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        // Signed URL — trigger download
        const a = document.createElement('a')
        a.href = data.url
        a.rel  = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }

      // Optimistically bump download count
      setResources((prev) =>
        prev.map((r) => r.id === resource.id ? { ...r, download_count: r.download_count + 1 } : r)
      )
    } finally {
      setDownloading(null)
    }
  }

  const types = ['all', ...Array.from(new Set(resources.map((r) => r.resource_type)))]

  const filtered = resources.filter((r) => {
    const matchType   = typeFilter === 'all' || r.resource_type === typeFilter
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
                        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const accessibleCount = resources.filter((r) => r.accessible).length

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Resource Library</h1>
        <p className="text-slate-400 mt-2">
          {accessibleCount} resource{accessibleCount !== 1 ? 's' : ''} available to you
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <File className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400">No resources available yet.</p>
        </div>
      ) : (
        <>
          {/* Search + filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                className="input-field pl-9"
                placeholder="Search resources…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select className="input-field pl-9 pr-4" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>{t === 'all' ? 'All types' : (TYPE_LABELS[t] ?? t)}</option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">No resources match your search.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((r) => {
                const Icon = TYPE_ICONS[r.resource_type] ?? File
                const isLoading = downloading === r.id

                return (
                  <div key={r.id}
                    className={`card p-5 flex flex-col gap-3 transition-all ${r.accessible ? 'hover:border-navy-700' : 'opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.accessible ? 'bg-gold-500/10' : 'bg-navy-800'}`}>
                        {r.accessible
                          ? <Icon className="w-5 h-5 text-gold-400" />
                          : <Lock className="w-5 h-5 text-slate-600" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm leading-snug">{r.title}</p>
                        {r.description && (
                          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{r.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-navy-800 text-slate-400 border border-navy-700">
                        {TYPE_LABELS[r.resource_type] ?? r.resource_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.accessible ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 bg-navy-800 border-navy-700'}`}>
                        {r.accessible ? ACCESS_LABELS[r.access_type] ?? r.access_type : 'Locked'}
                      </span>
                      {r.file_size && (
                        <span className="text-xs text-slate-500">{(r.file_size / 1024 / 1024).toFixed(1)} MB</span>
                      )}
                    </div>

                    <button
                      onClick={() => download(r)}
                      disabled={!r.accessible || isLoading}
                      className={`w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl transition-all border ${
                        r.accessible
                          ? 'bg-gold-500/10 border-gold-500/30 text-gold-400 hover:bg-gold-500/20'
                          : 'bg-navy-800/50 border-navy-700 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</>
                        : r.accessible
                          ? <><Download className="w-4 h-4" /> Download</>
                          : <><Lock className="w-4 h-4" /> {ACCESS_LABELS[r.access_type] ?? 'Unlock'}</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
