import type { PulseScores, PulseTrendPoint } from '@/types/hr-analytics'
import type { ImpactMetricKey } from '@/types/hr-impact'
import type { InsightDataSource } from '@/types/hr-insights'
import type { OnboardingSurvey } from '@/types/hr-data'

/**
 * Which way "better" runs for each measure.
 *
 * Every entry except workload is a documented 1–5 satisfaction score where a
 * higher number is the desirable outcome. Workload is the exception, and it is
 * NOT assumed here: the workbook's `Data_Dictionary` states "Perceived workload
 * pressure, 1-5; higher = worse", the analytics layer parses that sentence at
 * load time, and the impact service prefers the parsed value over this default.
 * If a future workbook changed the wording, the direction would follow the data
 * rather than this file.
 */
export type MetricDirection = 'higher-is-better' | 'lower-is-better'

export const METRIC_DIRECTION = {
  engagement: 'higher-is-better',
  managerSupport: 'higher-is-better',
  careerGrowth: 'higher-is-better',
  belonging: 'higher-is-better',
  roleClarity: 'higher-is-better',
  toolsAccess: 'higher-is-better',
  onboardingOverall: 'higher-is-better',
  /** Confirmed from the Data Dictionary, and re-checked at runtime. */
  workload: 'lower-is-better',
} as const satisfies Record<string, MetricDirection>

export interface ImpactMetricDefinition {
  key: ImpactMetricKey
  label: string
  source: InsightDataSource
  direction: MetricDirection
  /** Reads the metric from one pulse wave point, for pulse-based measures. */
  readPulse?: (point: PulseTrendPoint) => number | null
  /** Reads the metric from one onboarding response, for onboarding measures. */
  readOnboarding?: (row: OnboardingSurvey) => number
  /** Where a later reading would come from, in words. */
  nextMeasurementLabel: string
}

const pulseMetric = (
  key: ImpactMetricKey,
  label: string,
  field: keyof PulseScores,
  direction: MetricDirection = 'higher-is-better',
): ImpactMetricDefinition => ({
  key,
  label,
  source: 'Pulse Survey',
  direction,
  readPulse: (point) => point[field],
  nextMeasurementLabel: 'Next pulse survey wave',
})

const onboardingMetric = (
  key: ImpactMetricKey,
  label: string,
  read: (row: OnboardingSurvey) => number,
): ImpactMetricDefinition => ({
  key,
  label,
  source: 'Onboarding Survey',
  direction: 'higher-is-better',
  readOnboarding: read,
  nextMeasurementLabel: 'Next onboarding survey responses',
})

/** The only measures this prototype will track an action against. */
export const IMPACT_METRICS: Record<ImpactMetricKey, ImpactMetricDefinition> = {
  'pulse-engagement': pulseMetric('pulse-engagement', 'Pulse Engagement', 'engagement'),
  'pulse-manager-support': pulseMetric(
    'pulse-manager-support',
    'Pulse Manager Support',
    'managerSupport',
  ),
  'pulse-career-growth': pulseMetric(
    'pulse-career-growth',
    'Pulse Career Growth',
    'careerGrowth',
  ),
  'pulse-belonging': pulseMetric('pulse-belonging', 'Pulse Belonging', 'belonging'),
  'pulse-workload': pulseMetric(
    'pulse-workload',
    'Pulse Workload',
    'workload',
    METRIC_DIRECTION.workload,
  ),
  'onboarding-overall': onboardingMetric(
    'onboarding-overall',
    'Onboarding Overall',
    (row) => row.overallScore,
  ),
  'onboarding-manager-support': onboardingMetric(
    'onboarding-manager-support',
    'Onboarding Manager Support',
    (row) => row.managerSupport,
  ),
  'onboarding-role-clarity': onboardingMetric(
    'onboarding-role-clarity',
    'Onboarding Role Clarity',
    (row) => row.roleClarity,
  ),
  'onboarding-tools-access': onboardingMetric(
    'onboarding-tools-access',
    'Onboarding Tools Access',
    (row) => row.toolsAccess,
  ),
}
