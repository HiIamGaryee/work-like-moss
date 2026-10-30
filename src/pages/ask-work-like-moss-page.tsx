import { ArrowUp, ChevronDown, MessageSquareText, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { DatasetError, DatasetSkeleton } from '@/components/dataset-status'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AssistantAnswerView } from '@/features/assistant/assistant-answer'
import { QUESTION_CATEGORIES } from '@/features/assistant/assistant.config'
import {
  buildAssistantResponse,
  buildExecutiveSnapshot,
} from '@/features/assistant/assistant.service'
import type { AssistantContext, ChatMessage } from '@/features/assistant/assistant.types'
import { ExecutiveSnapshot } from '@/features/assistant/executive-snapshot'
import { useHrImpact } from '@/hooks/use-hr-impact'
import { cn } from '@/lib/utils'

export function AskWorkLikeMossPage() {
  const {
    analytics,
    intelligenceItems,
    recommendations,
    demoActions,
    impacts,
    summary,
    isLoading,
    error,
    retry,
  } = useHrImpact()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState<AssistantContext>({})
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  const assistantData = analytics
    ? {
        analytics,
        intelligenceItems,
        recommendations,
        actions: demoActions,
        impacts,
        impactSummary: summary,
      }
    : null
  const snapshot = assistantData ? buildExecutiveSnapshot(assistantData) : []

  const submitQuestion = (value: string): void => {
    const cleanQuestion = value.trim()
    if (!cleanQuestion || !assistantData) return

    const response = buildAssistantResponse({
      question: cleanQuestion,
      context,
      ...assistantData,
    })

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: cleanQuestion,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer.text,
        createdAt: new Date().toISOString(),
        answer: response.answer,
      },
    ])
    setContext(response.context)
    setQuestion('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submitQuestion(question)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    submitQuestion(question)
  }

  const clearChat = (): void => {
    setMessages([])
    setContext(context.lastDivision ? { lastDivision: context.lastDivision } : {})
    setQuestion('')
  }

  const selectDepartment = (department: string): void => {
    const lastDivision = department === 'company' ? undefined : department
    setContext(lastDivision ? { lastDivision } : {})
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Ask Work Like Moss"
        description="Executive answers from your current people intelligence data."
        actions={
          <>
            {messages.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearChat}>
                <Trash2 aria-hidden="true" />
                Clear Chat
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link to="/">View Dashboard</Link>
            </Button>
          </>
        }
      />

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      <Collapsible
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        className="space-y-2 lg:hidden"
      >
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            Executive Snapshot
            <ChevronDown
              className={cn('transition-transform', snapshotOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card size="sm">
            <CardContent>
              {isLoading ? <DatasetSkeleton rows={5} /> : <ExecutiveSnapshot items={snapshot} />}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-h-[680px]">
          <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b">
            <div className="flex size-9 items-center justify-center rounded-md bg-muted">
              <MessageSquareText className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Executive Conversation</p>
              <p className="text-xs text-muted-foreground">
                Ask, review the evidence, then follow the decision trail.
              </p>
            </div>
            <Select value={context.lastDivision ?? 'company'} onValueChange={selectDepartment}>
              <SelectTrigger size="sm" aria-label="Department scope">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="company">Company-wide</SelectItem>
                {analytics?.divisions.map(({ division }) => (
                  <SelectItem key={division} value={division}>{division}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">CEO Intelligence View</Badge>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col">
            {isLoading ? <DatasetSkeleton rows={5} /> : null}

            {!isLoading && messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center py-8">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-lg border bg-muted/30">
                    <MessageSquareText className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">What should I know today?</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Review the current signal, supporting evidence, linked action, and measured
                    outcome.
                  </p>
                </div>

                <div className="mx-auto mt-7 grid w-full max-w-3xl gap-5 sm:grid-cols-2">
                  {QUESTION_CATEGORIES.map((category) => (
                    <section key={category.label} className="space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {category.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {category.questions.map((suggestion) => (
                          <Button
                            key={suggestion}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto justify-start whitespace-normal"
                            onClick={() => submitQuestion(suggestion)}
                            disabled={!assistantData}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.length > 0 ? (
              <div className="flex flex-1 flex-col gap-5 py-2" aria-live="polite">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex max-w-[92%] animate-in flex-col gap-1.5 fade-in slide-in-from-bottom-1 duration-200',
                      message.role === 'user' ? 'ml-auto items-end sm:max-w-[75%]' : 'items-start',
                    )}
                  >
                    <p className="px-1 text-xs font-medium text-muted-foreground">
                      {message.role === 'user' ? 'You' : 'Work Like Moss'}
                    </p>
                    <div
                      className={cn(
                        'w-full rounded-lg border px-4 py-3 text-[15px]',
                        message.role === 'user'
                          ? 'bg-foreground text-background'
                          : 'bg-muted/30',
                      )}
                    >
                      {message.answer ? (
                        <AssistantAnswerView
                          answer={message.answer}
                          onQuestion={submitQuestion}
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="block bg-background">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a management question..."
                aria-label="Ask Work Like Moss"
                className="max-h-32 min-h-10 resize-none"
                disabled={!assistantData || isLoading}
              />
              <Button
                type="submit"
                size="icon-lg"
                aria-label="Send question"
                disabled={!assistantData || !question.trim()}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on the current Work Like Moss demo dataset and calculated analysis.
            </p>
          </CardFooter>
        </Card>

        <aside className="sticky top-20 hidden lg:block" aria-label="Executive context">
          <Card size="sm">
            <CardHeader className="border-b">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase">Executive Context</p>
                <p className="mt-1 text-xs text-muted-foreground">Current decision snapshot</p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <DatasetSkeleton rows={5} /> : <ExecutiveSnapshot items={snapshot} />}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
