import type { CourseStatus } from '@/types/database'

const CONFIG: Record<CourseStatus, { label: string; classes: string }> = {
  draft:     { label: 'Draft',       classes: 'bg-slate-700 text-slate-300' },
  review:    { label: 'In Review',   classes: 'bg-yellow-500/20 text-yellow-400' },
  published: { label: 'Published',   classes: 'bg-emerald-500/20 text-emerald-400' },
  rejected:  { label: 'Rejected',    classes: 'bg-red-500/20 text-red-400' },
  archived:  { label: 'Archived',    classes: 'bg-slate-600/40 text-slate-500' },
}

export default function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.draft
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
