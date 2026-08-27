const PRINCIPLES = [
  { label: 'Evidence-based', detail: 'Every signal cites the measures behind it.' },
  { label: 'Human-approved', detail: 'The system suggests; a person decides.' },
  { label: 'Group-level analysis', detail: 'Findings describe cohorts, not individuals.' },
  {
    label: 'No individual retention prediction',
    detail: 'No person is scored for risk, loyalty or likelihood of leaving.',
  },
] as const

/**
 * The four commitments the analysis rests on, stated once and compactly.
 *
 * Deliberately a single line of small print rather than a disclaimer panel: the
 * boundaries belong where the numbers are read, and a wall of caveats gets
 * skipped by exactly the reader who needs it.
 */
export function ProductPrinciples() {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t pt-4">
      {PRINCIPLES.map((principle) => (
        <div key={principle.label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="text-xs font-medium whitespace-nowrap">{principle.label}</dt>
          <dd className="text-xs break-words text-muted-foreground">{principle.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
