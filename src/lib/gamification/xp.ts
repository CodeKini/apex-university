// Server-side only XP/badge/level logic.
// NEVER import this in client components.

import { createServiceRoleClient } from '@/lib/supabase/server'

export type XpEventType =
  | 'complete_lesson'
  | 'pass_quiz'
  | 'complete_course'
  | 'earn_certificate'
  | 'complete_path'
  | 'community_post'
  | 'receive_reaction'
  | 'refer_purchase'
  | 'daily_streak'

// Level thresholds: xp_for_level_n_to_reach = 50 * (n-1) * n
// L1=0, L2=100, L3=300, L4=600, L5=1000, L10=4500, L20=19000, L50=122500
export function getLevelInfo(totalXp: number) {
  let level = 1
  while (level < 50) {
    const nextThreshold = 50 * level * (level + 1)
    if (totalXp < nextThreshold) break
    level++
  }
  const curThreshold  = 50 * (level - 1) * level
  const nextThreshold = level >= 50 ? curThreshold + 1 : 50 * level * (level + 1)
  const xpInLevel     = totalXp - curThreshold
  const xpNeeded      = nextThreshold - curThreshold
  return {
    level,
    xp_in_level:  xpInLevel,
    xp_to_next:   xpNeeded,
    progress_pct: xpNeeded > 0 ? Math.round((xpInLevel / xpNeeded) * 100) : 100,
  }
}

const DEFAULT_XP: Record<XpEventType, number> = {
  complete_lesson:  10,
  pass_quiz:        25,
  complete_course:  100,
  earn_certificate: 150,
  complete_path:    200,
  community_post:   5,
  receive_reaction: 2,
  refer_purchase:   500,
  daily_streak:     15,
}

// Events that are idempotent per reference_id (awarded once per unique reference)
const IDEMPOTENT_EVENTS = new Set<XpEventType>([
  'complete_lesson', 'pass_quiz', 'complete_course',
  'earn_certificate', 'complete_path', 'refer_purchase',
])

// Award XP. Fire-and-forget safe (swallows all errors to avoid breaking callers).
// Returns XP awarded (0 if skipped, disabled, or already awarded).
export async function awardXP({
  userId, workspaceId, eventType, referenceId,
}: {
  userId:       string
  workspaceId:  string
  eventType:    XpEventType
  referenceId?: string
}): Promise<number> {
  try {
    return await _awardXP({ userId, workspaceId, eventType, referenceId })
  } catch (e) {
    console.error('[XP] awardXP error:', e)
    return 0
  }
}

async function _awardXP({
  userId, workspaceId, eventType, referenceId,
}: {
  userId: string; workspaceId: string; eventType: XpEventType; referenceId?: string
}): Promise<number> {
  const svc = createServiceRoleClient() as any

  // Load workspace settings (null = use defaults, all enabled)
  const { data: cfg } = await svc
    .from('xp_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (cfg?.enabled === false) return 0
  if (cfg && cfg[`ev_${eventType}`] === false) return 0

  const xpAmount: number = cfg?.[`xp_${eventType}`] ?? DEFAULT_XP[eventType]
  if (!xpAmount || xpAmount <= 0) return 0

  // Idempotency: one XP award per (user, workspace, eventType, referenceId)
  if (referenceId && IDEMPOTENT_EVENTS.has(eventType)) {
    const { count } = await svc
      .from('xp_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .eq('reference_id', referenceId)
    if ((count ?? 0) > 0) return 0
  }

  // Insert ledger entry
  await svc.from('xp_ledger').insert({
    workspace_id: workspaceId,
    user_id:      userId,
    event_type:   eventType,
    xp_awarded:   xpAmount,
    reference_id: referenceId ?? null,
  })

  // Upsert user_xp aggregate + streak
  const today = new Date().toISOString().split('T')[0]

  const { data: prev } = await svc
    .from('user_xp')
    .select('total_xp, current_streak_days, longest_streak_days, last_activity_date')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  let streak   = prev?.current_streak_days ?? 0
  let longest  = prev?.longest_streak_days ?? 0
  let lastDate = prev?.last_activity_date ?? null
  let dailyBonusXp = 0

  const isNewDay = lastDate !== today
  if (isNewDay) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toISOString().split('T')[0]
    streak  = lastDate === yStr ? streak + 1 : 1
    longest = Math.max(longest, streak)
    lastDate = today

    // Award daily streak bonus (once per day, not recursive)
    if (eventType !== 'daily_streak') {
      const streakEnabled = !cfg || cfg.ev_daily_streak !== false
      const streakXp: number = cfg?.xp_daily_streak ?? DEFAULT_XP.daily_streak

      if (streakEnabled && streakXp > 0) {
        // Check not already awarded today
        const { count: sCount } = await svc
          .from('xp_ledger')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId)
          .eq('event_type', 'daily_streak')
          .gte('created_at', `${today}T00:00:00.000Z`)

        if ((sCount ?? 0) === 0) {
          await svc.from('xp_ledger').insert({
            workspace_id: workspaceId,
            user_id:      userId,
            event_type:   'daily_streak',
            xp_awarded:   streakXp,
            reference_id: today,
          })
          dailyBonusXp = streakXp
        }
      }
    }
  }

  const newTotal = (prev?.total_xp ?? 0) + xpAmount + dailyBonusXp
  const { level } = getLevelInfo(newTotal)

  await svc.from('user_xp').upsert({
    workspace_id:        workspaceId,
    user_id:             userId,
    total_xp:            newTotal,
    current_level:       level,
    current_streak_days: streak,
    longest_streak_days: longest,
    last_activity_date:  lastDate,
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'workspace_id,user_id' })

  // Check badges (fire-and-forget within this call)
  await checkAndAwardBadges(svc, userId, workspaceId)

  return xpAmount
}

const DEFAULT_BADGES = [
  { key: 'first_lesson',     name: 'First Step',        description: 'Completed your first lesson',         icon: '🎯', sort_order: 0 },
  { key: 'first_course',     name: 'Course Completer',  description: 'Completed your first course',         icon: '🎓', sort_order: 1 },
  { key: 'first_cert',       name: 'Certified',         description: 'Earned your first certificate',       icon: '🏆', sort_order: 2 },
  { key: 'streak_7',         name: 'Week Warrior',      description: 'Maintained a 7-day learning streak',  icon: '🔥', sort_order: 3 },
  { key: 'streak_30',        name: 'Month Master',      description: 'Maintained a 30-day streak',          icon: '⚡', sort_order: 4 },
  { key: 'community_star',   name: 'Community Star',    description: 'Made 10 or more community posts',     icon: '⭐', sort_order: 5 },
  { key: 'quiz_master',      name: 'Quiz Master',       description: 'Passed 10 quizzes',                   icon: '🧠', sort_order: 6 },
  { key: 'path_finisher',    name: 'Path Finisher',     description: 'Completed a learning path',           icon: '🛤️', sort_order: 7 },
  { key: 'affiliate_closer', name: 'Affiliate Closer',  description: 'Referred a student who made a purchase', icon: '🤝', sort_order: 8 },
]

export async function ensureWorkspaceBadges(svc: any, workspaceId: string) {
  const { data: existing } = await svc
    .from('badges')
    .select('key')
    .eq('workspace_id', workspaceId)

  const existingKeys = new Set((existing ?? []).map((b: any) => b.key))
  const toInsert = DEFAULT_BADGES
    .filter((b) => !existingKeys.has(b.key))
    .map((b) => ({ ...b, workspace_id: workspaceId }))

  if (toInsert.length) {
    await svc.from('badges').insert(toInsert)
  }
}

async function checkAndAwardBadges(svc: any, userId: string, workspaceId: string) {
  await ensureWorkspaceBadges(svc, workspaceId)

  const { data: badges } = await svc
    .from('badges')
    .select('id, key')
    .eq('workspace_id', workspaceId)
    .eq('is_enabled', true)

  if (!badges?.length) return

  const { data: alreadyAwarded } = await svc
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .in('badge_id', badges.map((b: any) => b.id))

  const awardedSet = new Set((alreadyAwarded ?? []).map((a: any) => a.badge_id))
  const unawarded  = badges.filter((b: any) => !awardedSet.has(b.id))
  if (!unawarded.length) return

  const [{ data: ledger }, { data: uxp }] = await Promise.all([
    svc.from('xp_ledger')
      .select('event_type')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId),
    svc.from('user_xp')
      .select('current_streak_days, longest_streak_days')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const counts: Record<string, number> = {}
  for (const e of ledger ?? []) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1

  const maxStreak = Math.max(uxp?.current_streak_days ?? 0, uxp?.longest_streak_days ?? 0)

  const qualifies = (key: string): boolean => {
    switch (key) {
      case 'first_lesson':     return (counts['complete_lesson'] ?? 0) >= 1
      case 'first_course':     return (counts['complete_course'] ?? 0) >= 1
      case 'first_cert':       return (counts['earn_certificate'] ?? 0) >= 1
      case 'streak_7':         return maxStreak >= 7
      case 'streak_30':        return maxStreak >= 30
      case 'community_star':   return (counts['community_post'] ?? 0) >= 10
      case 'quiz_master':      return (counts['pass_quiz'] ?? 0) >= 10
      case 'path_finisher':    return (counts['complete_path'] ?? 0) >= 1
      case 'affiliate_closer': return (counts['refer_purchase'] ?? 0) >= 1
      default:                 return false
    }
  }

  const toAward = unawarded.filter((b: any) => qualifies(b.key))
  if (!toAward.length) return

  await svc.from('user_badges').insert(
    toAward.map((b: any) => ({
      workspace_id: workspaceId,
      user_id:      userId,
      badge_id:     b.id,
    }))
  )
}
