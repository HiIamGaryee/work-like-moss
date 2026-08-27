import { MAX_VISIBLE_INSIGHTS } from '@/data/hr-insight-rules'
import { PRIORITY_LEVEL_ORDER } from '@/data/hr-priority-rules'
import { generateHrInsights } from '@/services/hr-insights.service'
import { calculateInsightPriority } from '@/services/hr-priority.service'
import { analyseLikelyDrivers } from '@/services/hr-root-cause.service'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem, HrIntelligenceResult } from '@/types/hr-intelligence'

/**
 * The single composition point for the intelligence layer:
 *
 *   detect (insights)  →  explain (likely drivers)  →  prioritise (score)
 *
 * It reuses the three services rather than duplicating any detection logic, and
 * it is deterministic: the same analytics object always produces the same items,
 * scores and ordering.
 */

/** How many issues the management attention panel surfaces. */
export const MAX_TOP_PRIORITY_ITEMS = 3

export function generateHrIntelligence(analytics: HrAnalytics): HrIntelligenceResult {
  const detected = generateHrInsights(analytics)

  const items: HrIntelligenceItem[] = detected.allInsights.map((insight) => {
    const likelyDrivers = analyseLikelyDrivers(insight, analytics)
    return {
      insight: { ...insight, likelyDrivers },
      likelyDrivers,
      priority: calculateInsightPriority(insight, analytics, likelyDrivers),
    }
  })

  const ranked = rankByPriority(items)

  return {
    items: ranked,
    visibleItems: ranked.slice(0, MAX_VISIBLE_INSIGHTS),
    topPriorityItems: ranked.slice(0, MAX_TOP_PRIORITY_ITEMS),
  }
}

/** Level, then score, then insight id — stable across renders. */
function rankByPriority(items: readonly HrIntelligenceItem[]): HrIntelligenceItem[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_LEVEL_ORDER[a.priority.level] - PRIORITY_LEVEL_ORDER[b.priority.level] ||
      b.priority.score - a.priority.score ||
      a.insight.id.localeCompare(b.insight.id),
  )
}

export { generateHrInsights }
