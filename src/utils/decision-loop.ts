import type { LoopStageStatus, MeasurementStatus } from '@/types/hr-impact'

/**
 * The traceability chain, as data. Kept out of the component so the stage rules
 * can be read and tested without rendering anything.
 */

export type DecisionLoopStage = {
  label: string
  status: LoopStageStatus
  /** Shown under the label, e.g. "Awaiting" on the measure stage. */
  detail?: string
}

/**
 * Stages for one tracked action. Detect, explain and prioritise are complete
 * whenever the action traces back to a detected insight; act is complete once a
 * human approved it; measure follows the real measurement state rather than the
 * action's own status, because finishing work is not the same as knowing whether
 * it moved anything.
 */
export function buildActionLoopStages(input: {
  hasInsight: boolean
  actionApproved: boolean
  measurementStatus: MeasurementStatus
}): DecisionLoopStage[] {
  const traced: LoopStageStatus = input.hasInsight ? 'complete' : 'pending'

  const measure: DecisionLoopStage =
    input.measurementStatus === 'measurement-available'
      ? { label: 'Measure', status: 'complete' }
      : input.measurementStatus === 'awaiting-measurement'
        ? { label: 'Measure', status: 'current', detail: 'Awaiting' }
        : { label: 'Measure', status: 'pending', detail: 'Not configured' }

  return [
    { label: 'Detect', status: traced },
    { label: 'Explain', status: traced },
    { label: 'Prioritise', status: traced },
    { label: 'Act', status: input.actionApproved ? 'complete' : 'pending' },
    measure,
  ]
}
