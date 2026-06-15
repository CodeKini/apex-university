'use client'

import DOMPurify from 'isomorphic-dompurify'
import { ExternalLink, FileText, Video, Globe, Calendar, Link2 } from 'lucide-react'

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'del',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel', 'width', 'height',
]

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: true,
    ALLOW_DATA_ATTR: false,
  }) as string
}

interface Lesson {
  id: string
  title: string
  content_type: string
  content: Record<string, any> | null
  description: string | null
  duration_mins: number
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/)
  return m ? m[1] : null
}

function VideoViewer({ content }: { content: Record<string, any> }) {
  const url: string = content.url ?? ''
  const platform: string = content.platform ?? 'other'

  if (platform === 'youtube' || url.includes('youtube') || url.includes('youtu.be')) {
    const vid = getYouTubeId(url)
    if (vid) return (
      <div className="aspect-video w-full rounded-xl overflow-hidden">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (platform === 'vimeo' || url.includes('vimeo')) {
    const vid = getVimeoId(url)
    if (vid) return (
      <div className="aspect-video w-full rounded-xl overflow-hidden">
        <iframe
          src={`https://player.vimeo.com/video/${vid}`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (url) return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
      <video src={url} controls className="w-full h-full" />
    </div>
  )

  return <EmptyContent icon={<Video className="w-10 h-10 text-slate-600" />} label="No video URL set." />
}

function TextViewer({ content }: { content: Record<string, any> }) {
  const html = content.html ?? ''
  if (!html) return <EmptyContent icon={<FileText className="w-10 h-10 text-slate-600" />} label="No content yet." />
  return (
    <div
      className="prose prose-invert prose-slate max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitize(html) }}
    />
  )
}

function EmbedViewer({ content, type }: { content: Record<string, any>; type: 'canva' | 'google_embed' }) {
  const url: string = content.url ?? ''
  const label = type === 'canva' ? 'Canva' : 'Google'

  if (!url) return <EmptyContent icon={<Globe className="w-10 h-10 text-slate-600" />} label={`No ${label} embed URL set.`} />

  return (
    <div className="w-full rounded-xl overflow-hidden border border-navy-800" style={{ height: 560 }}>
      <iframe src={url} className="w-full h-full" allow="fullscreen" />
    </div>
  )
}

function FileViewer({ content }: { content: Record<string, any> }) {
  const url: string = content.url ?? ''
  if (!url) return <EmptyContent icon={<FileText className="w-10 h-10 text-slate-600" />} label="No file URL set." />
  return (
    <div className="card p-8 flex flex-col items-center gap-4">
      <FileText className="w-12 h-12 text-slate-500" />
      <p className="text-slate-400 text-sm">File resource</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
        Open file <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}

function LiveViewer({ content }: { content: Record<string, any> }) {
  const url: string  = content.meeting_url ?? ''
  const dt: string   = content.starts_at ?? ''

  const formatted = dt
    ? new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="card p-8 flex flex-col items-center gap-4 text-center">
      <Calendar className="w-12 h-12 text-gold-400" />
      <h3 className="text-white font-semibold text-lg">Live Session</h3>
      {formatted && <p className="text-slate-400 text-sm">{formatted}</p>}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
          Join session <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <p className="text-slate-500 text-sm">Meeting link not yet available.</p>
      )}
    </div>
  )
}

function LinkViewer({ content }: { content: Record<string, any> }) {
  const url: string = content.url ?? ''
  if (!url) return <EmptyContent icon={<Link2 className="w-10 h-10 text-slate-600" />} label="No link set." />
  return (
    <div className="card p-8 flex flex-col items-center gap-4">
      <Link2 className="w-12 h-12 text-slate-500" />
      <p className="text-slate-400 text-sm break-all max-w-sm text-center">{url}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
        Open link <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}

function EmptyContent({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {icon}
      <p className="text-slate-500 text-sm">{label}</p>
    </div>
  )
}

export default function LessonViewer({ lesson }: { lesson: Lesson }) {
  const c = lesson.content ?? {}

  return (
    <div className="space-y-6">
      {/* Content */}
      {lesson.content_type === 'video'        && <VideoViewer content={c} />}
      {lesson.content_type === 'text'         && <TextViewer  content={c} />}
      {lesson.content_type === 'canva'        && <EmbedViewer content={c} type="canva" />}
      {lesson.content_type === 'google_embed' && <EmbedViewer content={c} type="google_embed" />}
      {lesson.content_type === 'file'         && <FileViewer  content={c} />}
      {lesson.content_type === 'live'         && <LiveViewer  content={c} />}
      {lesson.content_type === 'link'         && <LinkViewer  content={c} />}

      {/* Description */}
      {lesson.description && (
        <div className="card p-6 text-slate-300 text-sm leading-relaxed whitespace-pre-line">
          {lesson.description}
        </div>
      )}
    </div>
  )
}
