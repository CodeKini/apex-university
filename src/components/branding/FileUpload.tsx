'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2, ImageIcon }  from 'lucide-react'

interface Props {
  workspaceId: string
  type:        'logo' | 'favicon' | 'cover'
  currentUrl:  string
  onUploaded:  (url: string) => void
  label?:      string
  hint?:       string
  aspect?:     'square' | 'wide'
}

export default function FileUpload({
  workspaceId,
  type,
  currentUrl,
  onUploaded,
  label,
  hint,
  aspect = 'square',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [preview,   setPreview]   = useState(currentUrl)
  const [dragging,  setDragging]  = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setError('')
    setUploading(true)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)

    const res  = await fetch(`/api/platform/workspaces/${workspaceId}/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
    setPreview(data.url)
    onUploaded(data.url)
  }, [workspaceId, type, onUploaded])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  const containerClass = aspect === 'square'
    ? 'w-24 h-24'
    : 'w-full h-32'

  return (
    <div>
      {label && <label className="label mb-1.5 block">{label}</label>}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          ${containerClass} relative rounded-xl border-2 border-dashed
          flex items-center justify-center overflow-hidden cursor-pointer transition-all
          ${dragging  ? 'border-gold-400 bg-gold-500/10' : 'border-navy-700 hover:border-navy-600 bg-navy-900/40'}
        `}
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : uploading ? (
          <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <ImageIcon className="w-6 h-6" />
            <span className="text-xs">Upload</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-navy-900/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
          </div>
        )}
      </div>

      {preview && (
        <button
          type="button"
          onClick={() => { setPreview(''); onUploaded('') }}
          className="mt-1.5 text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
        >
          <X className="w-3 h-3" /> Remove
        </button>
      )}

      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/x-icon"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  )
}
