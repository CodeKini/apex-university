// Best-effort notification creation — never throws, never blocks.
import { createServiceRoleClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'post_comment'
  | 'comment_reply'
  | 'new_announcement'
  | 'new_dm'
  | 'reaction'

interface NotifyInput {
  workspaceId: string
  userId:      string
  type:        NotificationType
  title:       string
  body?:       string
  link?:       string
}

export async function createNotification(input: NotifyInput) {
  try {
    const supabase = createServiceRoleClient() as any
    await supabase.from('notifications').insert({
      workspace_id: input.workspaceId,
      user_id:      input.userId,
      type:         input.type,
      title:        input.title,
      body:         input.body ?? null,
      link:         input.link ?? null,
    })
  } catch {
    // notifications are non-critical
  }
}
