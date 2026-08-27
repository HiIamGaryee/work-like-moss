import type { ActionImpact } from '@/types/hr-impact'
import { EMPTY_VALUE, formatDate, formatScore } from '@/utils/format'

type MeasurementTimelineProps = {
  impact: ActionImpact
}

type TimelineEntry = {
  key: string
  when: string
  what: string
  detail?: string
  /** Rendered as an open marker when the event has not happened yet. */
  pending?: boolean
}

/**
 * The dates behind one tracked action, in order.
 *
 * Only dates the data actually holds appear here. Where the next measurement
 * date is unknown — this workbook has no survey schedule — the entry says so
 * rather than inventing a plausible-looking future date.
 */
export function MeasurementTimeline({ impact }: MeasurementTimelineProps) {
  const { measurement } = impact

  const entries: TimelineEntry[] = [
    ...(measurement?.baselineDate
      ? [
          {
            key: 'baseline',
            when: formatDate(measurement.baselineDate),
            what: 'Baseline measured',
            detail:
              measurement.baselineValue === null
                ? undefined
                : `${measurement.label} ${formatScore(measurement.baselineValue)}`,
          },
        ]
      : []),
    { key: 'start', when: formatDate(impact.startDate), what: 'Action started' },
    ...(impact.dueDate !== impact.startDate
      ? [{ key: 'due', when: formatDate(impact.dueDate), what: 'Action due' }]
      : []),
    ...(measurement?.currentDate && measurement.currentValue !== null
      ? [
          {
            key: 'measured',
            when: formatDate(measurement.currentDate),
            what: `${impact.dataSources[0] ?? 'Survey'} measurement`,
            detail: `${measurement.label} ${formatScore(measurement.currentValue)}`,
          },
        ]
      : [
          {
            key: 'pending',
            when: impact.nextMeasurementLabel,
            /* No survey schedule exists in this dataset, so no date is guessed. */
            what: 'Measurement pending',
            detail: 'Date not available',
            pending: true,
          },
        ]),
  ]

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.key} className="flex gap-3">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2 shrink-0 rounded-full ${
              entry.pending ? 'border border-dashed border-muted-foreground' : 'bg-foreground'
            }`}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs break-words text-muted-foreground tabular-nums">
              {entry.when || EMPTY_VALUE}
            </p>
            <p className="text-sm font-medium break-words">{entry.what}</p>
            {entry.detail ? (
              <p className="text-xs break-words text-muted-foreground tabular-nums">
                {entry.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
