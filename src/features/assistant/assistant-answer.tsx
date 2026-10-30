import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AssistantAnswer } from '@/features/assistant/assistant.types'
import { useDemoRole } from '@/hooks/use-demo-role'
import { cn } from '@/lib/utils'

type AssistantAnswerProps = {
  answer: AssistantAnswer
  onQuestion: (question: string) => void
}

export function AssistantAnswerView({ answer, onQuestion }: AssistantAnswerProps) {
  const { isAllowed } = useDemoRole()
  const showRelatedRoute = answer.relatedRoute && isAllowed(answer.relatedRoute)

  return (
    <div className="space-y-2.5">
      <p className="text-[15px] leading-6">{answer.text}</p>

      {answer.metric ? (
        <div
          className={cn(
            'rounded-lg border bg-background p-3.5',
            answer.severity === 'attention' && 'border-foreground/20',
          )}
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {answer.metric.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{answer.metric.value}</p>
          {answer.metric.comparison ? (
            <p className="mt-1 text-xs text-muted-foreground">{answer.metric.comparison}</p>
          ) : null}
        </div>
      ) : null}

      {answer.sections?.length ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {answer.sections.map((section) => (
            <div key={`${section.label}-${section.content}`} className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
              <p className="mt-1.5 text-sm leading-5">{section.content}</p>
            </div>
          ))}
        </div>
      ) : null}

      {answer.sources?.length || answer.evidenceQuality ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.evidenceQuality ? <Badge variant="secondary">{answer.evidenceQuality}</Badge> : null}
          {answer.sources?.map((source) => (
            <Badge key={source} variant="outline">{source}</Badge>
          ))}
        </div>
      ) : null}

      {answer.followUps?.length ? (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs text-muted-foreground">Continue the review</p>
          <div className="flex flex-wrap gap-1.5">
            {answer.followUps.slice(0, 3).map((followUp) => (
              <Button
                key={followUp}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal"
                onClick={() => onQuestion(followUp)}
              >
                {followUp}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {answer.clarificationOptions?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.clarificationOptions.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onQuestion(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}

      {showRelatedRoute ? (
        <Button variant="ghost" size="sm" asChild className="px-0 text-muted-foreground">
          <Link to={answer.relatedRoute!}>
            View Dashboard
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
