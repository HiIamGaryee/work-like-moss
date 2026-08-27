import type { HrInsight, LikelyDriver } from '@/types/hr-insights'

/**
 * Issue-level prioritisation.
 *
 * A priority score ranks which *issue* management should review first. It is
 * never attached to a person, and it is not a probability, a confidence, or a
 * predicted outcome — it is a weighted combination of measured components,
 * every one of which is shown to the user.
 */

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low'

/** Each component is 0–100, or `null` when the dataset cannot support it. */
export interface PriorityBreakdown {
  severity: number | null
  trend: number | null
  affectedPopulation: number | null
  retentionExposure: number | null
  evidenceStrength: number | null
}

export interface PriorityComponentDetail {
  key: keyof PriorityBreakdown
  label: string
  value: number | null
  /** Weight actually applied, after any missing component was reweighted out. */
  appliedWeight: number
  description: string
}

export interface InsightPriority {
  score: number
  level: PriorityLevel
  breakdown: PriorityBreakdown
  components: PriorityComponentDetail[]
  /** Plain-language reasons, assembled from the component values. */
  reasons: string[]
  explanation: string
}

export interface HrIntelligenceItem {
  insight: HrInsight
  likelyDrivers: LikelyDriver[]
  priority: InsightPriority
}

export interface HrIntelligenceResult {
  /** Every detected item, ranked by priority. */
  items: HrIntelligenceItem[]
  /** The visible subset, matching the insight engine's display limit. */
  visibleItems: HrIntelligenceItem[]
  /** Highest-priority items for the management attention panel. */
  topPriorityItems: HrIntelligenceItem[]
}
