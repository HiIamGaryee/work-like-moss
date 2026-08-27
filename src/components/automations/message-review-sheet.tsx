import { Copy, Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CARE_CHANNEL_OPTIONS, CHANNEL_CONSENT_NOTE } from '@/data/hr-care-demo'
import { AUTOMATION_TYPE_LABELS, CARE_CHANNEL_LABELS } from '@/data/hr-automation-rules'
import type { AutomationMessage, CareChannel, HrAutomationItem } from '@/types/hr-automation'
import { buildMailtoUrl } from '@/utils/email-link'
import { buildWhatsAppUrl } from '@/utils/whatsapp-link'

type MessageReviewSheetProps = {
  item: HrAutomationItem | null
  onClose: () => void
  onSaveMessage: (automationId: string, message: AutomationMessage) => void
  onMarkHandled: (automationId: string) => void
}

/**
 * The human step before any communication exists.
 *
 * Nothing on this panel sends anything. The buttons hand the drafted text to the
 * viewer's own email client or WhatsApp, where they still choose a recipient and
 * press send themselves — which is why they read "Open", not "Send", and why no
 * success message ever claims delivery. Marking the reminder handled stays a
 * separate decision.
 */
export function MessageReviewSheet({
  item,
  onClose,
  onSaveMessage,
  onMarkHandled,
}: MessageReviewSheetProps) {
  if (!item?.messageTemplate) return null

  return (
    <Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* Keyed on the reminder so a different one starts from its own draft. */}
      <MessageForm
        key={item.id}
        item={item}
        onClose={onClose}
        onSaveMessage={onSaveMessage}
        onMarkHandled={onMarkHandled}
      />
    </Sheet>
  )
}

type MessageFormProps = Omit<MessageReviewSheetProps, 'item'> & { item: HrAutomationItem }

function MessageForm({ item, onClose, onSaveMessage, onMarkHandled }: MessageFormProps) {
  const template = item.messageTemplate as AutomationMessage
  const [subject, setSubject] = useState(template.subject ?? '')
  const [body, setBody] = useState(template.body)
  const [channel, setChannel] = useState<CareChannel>(item.preferredChannel ?? 'none')

  const isInternal = item.messageAudience === 'internal'
  const message: AutomationMessage = {
    body,
    ...(subject.trim() === '' ? {} : { subject }),
  }

  /** Edits persist so a reviewer's wording survives a refresh. */
  const persist = (): void => onSaveMessage(item.id, message)

  const openExternal = (url: string, label: string): void => {
    persist()
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    /* Popup blockers and missing handlers both land here; Copy still works. */
    if (!opened) {
      toast.error(`Unable to open ${label}.`, {
        description: 'Use Copy message and paste it into your own app instead.',
      })
      return
    }
    toast.info(`${label} composer opened.`, {
      description: 'Review the message and send it yourself — nothing has been sent.',
    })
  }

  const copyMessage = async (): Promise<void> => {
    persist()
    const text = isInternal && subject ? `${subject}\n\n${body}` : body
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Message copied')
    } catch {
      toast.error('Unable to copy message.', {
        description: 'Select the text in the field and copy it manually.',
      })
    }
  }

  /**
   * The preferred channel leads, so the reviewer's first button is the one the
   * employee would actually want — but every composer stays available, because
   * a person may have a better reason than the stored preference.
   */
  const channelButtons = [
    {
      key: 'email' as const,
      label: 'Open Email',
      icon: Mail,
      onClick: () => openExternal(buildMailtoUrl(message), 'Email'),
    },
    /* Internal HR text is not routed to a personal messaging app. */
    ...(isInternal
      ? []
      : [
          {
            key: 'whatsapp' as const,
            label: 'Open WhatsApp',
            icon: MessageCircle,
            onClick: () => openExternal(buildWhatsAppUrl(body), 'WhatsApp'),
          },
        ]),
  ]

  const ordered = [...channelButtons].sort((a, b) =>
    a.key === channel ? -1 : b.key === channel ? 1 : 0,
  )

  return (
    <SheetContent
      side="right"
      className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      aria-describedby="message-review-description"
    >
      <SheetHeader className="pr-12">
        <SheetTitle>Review message</SheetTitle>
        <SheetDescription id="message-review-description">
          Edit the draft, then open your own email or WhatsApp to send it. Nothing is sent by this
          app.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-4">
        <section className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{AUTOMATION_TYPE_LABELS[item.type]}</Badge>
            <Badge variant={isInternal ? 'secondary' : 'ghost'} className="text-muted-foreground">
              {isInternal ? 'Internal HR reminder' : 'Employee-facing message'}
            </Badge>
          </div>
          <p className="text-sm font-medium break-words">
            {item.employeeName ?? item.employeeId ?? item.title}
          </p>
          <p className="text-xs break-words text-muted-foreground">{item.description}</p>
          {isInternal ? (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                This text is written for HR or the employee's manager. It is not addressed to the
                employee, and it carries no recipient — no manager contact data exists in this
                dataset.
              </p>
            </>
          ) : null}
        </section>

        <div className="space-y-1.5">
          <Label htmlFor="message-channel">Communication channel</Label>
          <Select value={channel} onValueChange={(value) => setChannel(value as CareChannel)}>
            <SelectTrigger id="message-channel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARE_CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {CARE_CHANNEL_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{CHANNEL_CONSENT_NOTE}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message-subject">Subject</Label>
          <Input
            id="message-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message-body">Message</Label>
          <Textarea
            id="message-body"
            rows={9}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Plain text only. Never include survey scores, priority scores or other HR analytics in a
            message to an employee.
          </p>
        </div>
      </div>

      <SheetFooter className="gap-2 border-t">
        <div className="flex flex-wrap items-center gap-2">
          {ordered.map(({ key, label, icon: Icon, onClick }, index) => (
            <Button
              key={key}
              size="sm"
              variant={index === 0 && channel !== 'none' ? 'default' : 'outline'}
              onClick={onClick}
            >
              <Icon aria-hidden="true" />
              {label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={copyMessage}>
            <Copy aria-hidden="true" />
            Copy message
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            persist()
            onMarkHandled(item.id)
            onClose()
          }}
        >
          Mark as handled
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
