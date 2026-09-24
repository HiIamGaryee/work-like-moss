import { ACTION_STATUS_LABELS, RECOMMENDATION_STATUS_LABELS } from '@/data/hr-action-catalog'
import type {
  ActionExecutionStatus,
  ActionMetric,
  ActionMetricUnit,
  HrAction,
  RecommendationReview,
  RecommendationReviewMap,
  RecommendedActionStatus,
} from '@/types/hr-actions'
import type { ImpactMetricKey, ImpactScope } from '@/types/hr-impact'
import type { PriorityLevel } from '@/types/hr-intelligence'
import type { InsightDataSource } from '@/types/hr-insights'
import { isValidIsoDate } from '@/utils/date'

/**
 * Local persistence for demo actions only.
 *
 * Two boundaries matter here:
 *
 *  1. The official workbook is never written. `Action_Tracker` records stay in
 *     the dataset and are re-read from the Excel file on every load, so nothing
 *     in localStorage can shadow, mutate or replace them.
 *  2. Nothing read back from localStorage is trusted. A person can edit browser
 *     storage; malformed JSON, a missing field or an unknown status drops the
 *     one record rather than throwing, and a corrupt payload falls back to an
 *     empty demo state instead of breaking the page.
 *
 * The version suffix in each key means a future schema change starts clean
 * rather than colliding with records it cannot parse.
 */

export const HR_ACTION_STORAGE_KEY = 'work-like-moss:hr-actions:v1'
export const HR_RECOMMENDATION_STATUS_STORAGE_KEY = 'work-like-moss:recommendation-status:v1'

/* --------------------------------------------------------------- primitives */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isFiniteOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

const ACTION_STATUSES = Object.keys(ACTION_STATUS_LABELS) as ActionExecutionStatus[]
const REVIEW_STATUSES = Object.keys(RECOMMENDATION_STATUS_LABELS) as RecommendedActionStatus[]
const METRIC_UNITS: readonly ActionMetricUnit[] = ['score', 'percentage', 'count']
const IMPACT_METRIC_KEYS: readonly ImpactMetricKey[] = [
  'pulse-engagement',
  'pulse-manager-support',
  'pulse-career-growth',
  'pulse-belonging',
  'pulse-workload',
  'onboarding-overall',
  'onboarding-manager-support',
  'onboarding-role-clarity',
  'onboarding-tools-access',
]
const SCOPE_KINDS: readonly ImpactScope['kind'][] = [
  'company',
  'division',
  'employee-group',
  'tenure-band',
  'new-joiners',
]

function parseImpactScope(value: unknown): ImpactScope | undefined {
  if (!isRecord(value)) return undefined
  if (!SCOPE_KINDS.includes(value.kind as ImpactScope['kind'])) return undefined
  const key = value.key
  if (key !== null && !isText(key)) return undefined
  return { kind: value.kind as ImpactScope['kind'], key: key === null ? null : key }
}
const PRIORITY_LEVELS: readonly PriorityLevel[] = ['critical', 'high', 'medium', 'low']
const EVIDENCE_SOURCES: readonly InsightDataSource[] = [
  'Employees', 'Onboarding Survey', 'Pulse Survey', 'Exit Survey', 'Action Tracker',
]

/* ------------------------------------------------------------ storage access */

/** `null` covers every failure: no storage, quota errors, and invalid JSON. */
function readJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw === null || raw === undefined ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Whether this browser will accept a write at all — private modes and blocked
 * site data both throw. Probed once so the UI can say so instead of failing
 * silently, and demo state then lives for the session only.
 */
export function isStorageAvailable(): boolean {
  const probeKey = `${HR_ACTION_STORAGE_KEY}:probe`
  try {
    globalThis.localStorage?.setItem(probeKey, '1')
    globalThis.localStorage?.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/** `false` means the write did not happen — the caller keeps in-memory state. */
function writeJson(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ parsing */

function parseMetric(value: unknown): ActionMetric | undefined {
  if (!isRecord(value)) return undefined
  if (!isText(value.label) || !isFiniteOrNull(value.value)) return undefined
  if (!METRIC_UNITS.includes(value.unit as ActionMetricUnit)) return undefined
  return { label: value.label, value: value.value, unit: value.unit as ActionMetricUnit }
}

/** Every required field must be present and well-formed, or the record is dropped. */
function parseAction(value: unknown): HrAction | null {
  if (!isRecord(value)) return null

  const { id, title, owner, startDate, dueDate, successMeasure, status } = value

  if (!isText(id) || !isText(title) || !isText(owner) || !isText(successMeasure)) return null
  if (!isText(startDate) || !isValidIsoDate(startDate)) return null
  if (!isText(dueDate) || !isValidIsoDate(dueDate)) return null
  if (!ACTION_STATUSES.includes(status as ActionExecutionStatus)) return null

  const priorityLevel = PRIORITY_LEVELS.includes(value.priorityLevelAtCreation as PriorityLevel)
    ? (value.priorityLevelAtCreation as PriorityLevel)
    : undefined
  const baselineMetric = parseMetric(value.baselineMetric)
  const targetMetric = parseMetric(value.targetMetric)
  const impactMetricKey = IMPACT_METRIC_KEYS.includes(value.impactMetricKey as ImpactMetricKey)
    ? (value.impactMetricKey as ImpactMetricKey)
    : undefined
  const impactScope = parseImpactScope(value.impactScope)

  return {
    id,
    title,
    owner,
    startDate,
    dueDate,
    successMeasure,
    status: status as ActionExecutionStatus,
    description: isText(value.description) ? value.description : '',
    issueTitle: isText(value.issueTitle) ? value.issueTitle : '',
    affectedScope: isText(value.affectedScope) ? value.affectedScope : '',
    editedByHr: value.editedByHr === true,
    createdAt: isText(value.createdAt) ? value.createdAt : new Date().toISOString(),
    updatedAt: isText(value.updatedAt) ? value.updatedAt : new Date().toISOString(),
    ...(isText(value.sourceRecommendationId)
      ? { sourceRecommendationId: value.sourceRecommendationId }
      : {}),
    ...(isText(value.insightId) ? { insightId: value.insightId } : {}),
    ...(isText(value.issueId) ? { issueId: value.issueId } : {}),
    ...(Array.isArray(value.evidenceSources)
      ? {
          evidenceSources: value.evidenceSources.filter(
            (source: unknown): source is InsightDataSource =>
              typeof source === 'string' &&
              EVIDENCE_SOURCES.includes(source as InsightDataSource),
          ),
        }
      : {}),
    ...(typeof value.priorityScoreAtCreation === 'number' &&
    Number.isFinite(value.priorityScoreAtCreation)
      ? { priorityScoreAtCreation: value.priorityScoreAtCreation }
      : {}),
    ...(priorityLevel ? { priorityLevelAtCreation: priorityLevel } : {}),
    ...(baselineMetric ? { baselineMetric } : {}),
    ...(targetMetric ? { targetMetric } : {}),
    ...(impactMetricKey ? { impactMetricKey } : {}),
    ...(impactScope ? { impactScope } : {}),
    ...(isText(value.completedAt) ? { completedAt: value.completedAt } : {}),
    ...(isText(value.approvedAt) ? { approvedAt: value.approvedAt } : {}),
  }
}

function parseReview(value: unknown): RecommendationReview | null {
  if (!isRecord(value)) return null
  if (!REVIEW_STATUSES.includes(value.status as RecommendedActionStatus)) return null

  return {
    status: value.status as RecommendedActionStatus,
    reviewedAt: isText(value.reviewedAt) ? value.reviewedAt : new Date().toISOString(),
    ...(isText(value.rejectionReason) ? { rejectionReason: value.rejectionReason } : {}),
  }
}

/* ---------------------------------------------------------------------- api */

/** Duplicate ids cannot survive a load, so the Active list stays keyable. */
export function loadDemoActions(): HrAction[] {
  const parsed = readJson(HR_ACTION_STORAGE_KEY)
  if (!Array.isArray(parsed)) return []

  const byId = new Map<string, HrAction>()
  for (const entry of parsed) {
    const action = parseAction(entry)
    if (action) byId.set(action.id, action)
  }
  return [...byId.values()]
}

export const saveDemoActions = (actions: readonly HrAction[]): boolean =>
  writeJson(HR_ACTION_STORAGE_KEY, actions)

export function loadRecommendationReviews(): RecommendationReviewMap {
  const parsed = readJson(HR_RECOMMENDATION_STATUS_STORAGE_KEY)
  if (!isRecord(parsed)) return {}

  return Object.entries(parsed).reduce<RecommendationReviewMap>((reviews, [id, value]) => {
    const review = parseReview(value)
    if (review) reviews[id] = review
    return reviews
  }, {})
}

export const saveRecommendationReviews = (reviews: RecommendationReviewMap): boolean =>
  writeJson(HR_RECOMMENDATION_STATUS_STORAGE_KEY, reviews)

/** Clears demo state only. The official workbook is untouched by design. */
export function clearDemoActionState(): void {
  try {
    globalThis.localStorage?.removeItem(HR_ACTION_STORAGE_KEY)
    globalThis.localStorage?.removeItem(HR_RECOMMENDATION_STATUS_STORAGE_KEY)
  } catch {
    /* Storage is unavailable; the caller still resets its in-memory state. */
  }
}

/** Runtime ids for user-created records — never used for analytics conclusions. */
export function createDemoActionId(): string {
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  return `ACT-DEMO-${unique}`
}
