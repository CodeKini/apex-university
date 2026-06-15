'use client'

// Lightweight drag-and-drop list using the HTML5 Drag and Drop API.
// Zero dependencies. Works with any array of items that have an `id` string.
//
// Usage:
//   <SortableList
//     items={modules}
//     onReorder={(reordered) => handleReorder(reordered)}
//     renderItem={(item, { dragHandleProps, isDragging }) => <div {...dragHandleProps}>...</div>}
//   />

import { useState, useRef } from 'react'
import { GripVertical }     from 'lucide-react'

export interface DragHandleProps {
  draggable:       boolean
  onDragStart:     (e: React.DragEvent) => void
  onDragOver:      (e: React.DragEvent) => void
  onDrop:          (e: React.DragEvent) => void
  onDragEnd:       () => void
  'data-drag-id':  string
}

interface SortableListProps<T extends { id: string }> {
  items:        T[]
  onReorder:    (reordered: T[]) => void
  renderItem:   (item: T, meta: { handleProps: DragHandleProps; isDragging: boolean; isOver: boolean }) => React.ReactNode
  className?:   string
  itemClass?:   string
}

export default function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className = '',
  itemClass = '',
}: SortableListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId,     setOverId]     = useState<string | null>(null)
  const dragIndex                   = useRef<number>(-1)

  const handleDragStart = (id: string, index: number) => {
    setDraggingId(id)
    dragIndex.current = index
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (id !== draggingId) setOverId(id)
  }

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setOverId(null)
      return
    }

    const from = items.findIndex((i) => i.id === draggingId)
    const to   = items.findIndex((i) => i.id === targetId)
    if (from === -1 || to === -1) return

    const reordered = [...items]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    onReorder(reordered)

    setDraggingId(null)
    setOverId(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setOverId(null)
  }

  return (
    <div className={className}>
      {items.map((item, index) => {
        const isDragging = item.id === draggingId
        const isOver     = item.id === overId

        const handleProps: DragHandleProps = {
          draggable:      true,
          onDragStart:    () => handleDragStart(item.id, index),
          onDragOver:     (e) => handleDragOver(e, item.id),
          onDrop:         () => handleDrop(item.id),
          onDragEnd:      handleDragEnd,
          'data-drag-id': item.id,
        }

        return (
          <div
            key={item.id}
            className={`transition-all duration-100 ${itemClass} ${
              isDragging ? 'opacity-40' : ''
            } ${isOver ? 'border-t-2 border-gold-500' : ''}`}
          >
            {renderItem(item, { handleProps, isDragging, isOver })}
          </div>
        )
      })}
    </div>
  )
}

// Convenience grip handle button — wrap with the handleProps
export function DragHandle({ dragHandleProps }: { dragHandleProps: DragHandleProps }) {
  return (
    <div
      {...dragHandleProps}
      className="p-1.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-none"
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="w-4 h-4" />
    </div>
  )
}
