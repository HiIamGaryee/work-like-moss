import { useState } from 'react'
import { InfoHint } from '@/components/dashboard/info-hint'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CommentThemeMention, EvidenceSource } from '@/types/hr-analytics'
import { formatPercentage } from '@/utils/format'

const METHOD_HINT =
  'Rates show the share of comments containing keywords for each theme. A mention does not indicate sentiment or prove a cause.'
const SMALL_SAMPLE_HINT = 'Small sample — interpret as an investigation signal.'

const SOURCE_NAMES: Record<EvidenceSource, { short: string; full: string }> = {
  pulse: { short: 'Pulse', full: 'Pulse Survey' },
  onboarding: { short: 'Onboarding', full: 'Onboarding Survey' },
  exit: { short: 'Exit', full: 'Exit Survey' },
}

/** Restrained neutral steps, so source never depends on a hue. */
const SOURCE_BAR: Record<EvidenceSource, string> = {
  pulse: 'bg-foreground',
  onboarding: 'bg-foreground/60',
  exit: 'bg-foreground/30',
}

type Filter = 'all' | EvidenceSource

/**
 * Ranked mention rates. Bar length is each row's own percentage, because every
 * source has its own comment population: rates are never summed or pooled, and
 * themes overlap (one comment can match several), so this is not a part-to-whole.
 */
export function CommentThemeMentions({ mentions }: { mentions: CommentThemeMention[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  /* One entry per source, in first-seen order; its comment population and flag
     come from the source's own rows, never from adding rows together. */
  const sources = [...new Map(mentions.map((mention) => [mention.source, mention])).values()]
  const rows = mentions
    .filter((mention) => filter === 'all' || mention.source === filter)
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1))
  const top = rows[0]
  const axisMax = Math.max(10, Math.ceil(Math.max(0, ...rows.map((row) => row.percentage ?? 0)) / 10) * 10)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...sources.map((entry) => ({ key: entry.source, label: SOURCE_NAMES[entry.source].short })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Comment Theme Mentions
          <InfoHint label="comment theme mentions" hint={METHOD_HINT} />
        </CardTitle>
        <CardDescription>Keyword mentions across survey comments.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comment-theme mentions are available for this signal.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by source">
              {filters.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={filter === option.key}
                  onClick={() => setFilter(option.key)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    filter === option.key
                      ? 'border-foreground bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {top ? (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Highest mention rate</p>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatPercentage(top.percentage)}
                  </span>
                  <span className="text-sm font-medium">{top.label}</span>
                  <span className="text-sm text-muted-foreground">· {SOURCE_NAMES[top.source].short}</span>
                </p>
              </div>
            ) : null}

            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {sources.map((entry) => (
                <li key={entry.source} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', SOURCE_BAR[entry.source])} aria-hidden="true" />
                  <span className="font-medium text-foreground">{SOURCE_NAMES[entry.source].short}</span>
                  <span className="tabular-nums">n = {entry.totalComments}</span>
                  {entry.isSmallSample ? <span>· Small sample</span> : null}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 text-[11px] text-muted-foreground sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-x-4">
                <span />
                <span className="flex justify-between tabular-nums">
                  <span>0%</span>
                  <span>{axisMax}%</span>
                </span>
              </div>
              <ol className="space-y-3">
                {rows.map((row) => {
                  const rate = row.percentage ?? 0
                  const source = SOURCE_NAMES[row.source]
                  return (
                    <li
                      key={`${row.source}:${row.theme}`}
                      title={`${row.label} · ${source.full}: ${row.mentionCount} of ${row.totalComments} comments (${formatPercentage(row.percentage)})${row.isSmallSample ? ` · ${SMALL_SAMPLE_HINT}` : ''}`}
                      className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-x-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-x-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm leading-tight font-medium break-words">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{source.short}</p>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', SOURCE_BAR[row.source])}
                              style={{ width: `${Math.min(100, (rate / axisMax) * 100)}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                            {formatPercentage(row.percentage)}
                          </span>
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          {row.mentionCount} of {row.totalComments} comments
                          {row.isSmallSample ? (
                            <span
                              className="inline-flex size-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-900"
                              aria-label="Small sample"
                              title={SMALL_SAMPLE_HINT}
                            >
                              !
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
