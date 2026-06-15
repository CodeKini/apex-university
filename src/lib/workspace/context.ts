'use client'

// React context that makes the current workspace available to any client
// component inside /w/[workspace]/* routes.
// Populated by WorkspaceProvider in src/app/w/[workspace]/layout.tsx.

import { createContext, useContext } from 'react'
import type { WorkspaceContext } from '@/types/workspace'

const WorkspaceCtx = createContext<WorkspaceContext | null>(null)

export const WorkspaceProvider = WorkspaceCtx.Provider

export function useWorkspace(): WorkspaceContext {
  const ctx = useContext(WorkspaceCtx)
  if (!ctx) throw new Error('useWorkspace must be used inside a workspace route')
  return ctx
}

// Null-safe version — returns null outside workspace routes
export function useWorkspaceSafe(): WorkspaceContext | null {
  return useContext(WorkspaceCtx)
}
