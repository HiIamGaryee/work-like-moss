import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AUTOMATION_RULE_SUMMARY, AUTOMATION_RULES_NOTE } from '@/data/hr-automation-rules'
import { DEMO_EXTENSION_NOTE } from '@/data/hr-care-demo'

/**
 * Every threshold that decides what appears in the inbox, in one readable list.
 * A reminder the reader cannot explain is a reminder they cannot trust.
 */
export function AutomationRulesSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          How reminders work
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        aria-describedby="automation-rules-description"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>How reminders work</SheetTitle>
          <SheetDescription id="automation-rules-description">
            <Badge variant="outline">Prototype automation rules</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <dl className="divide-y">
            {AUTOMATION_RULE_SUMMARY.map((rule) => (
              <div key={rule.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
                <dt className="text-sm font-medium">{rule.label}</dt>
                <dd className="ml-auto text-sm text-muted-foreground">{rule.value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-muted-foreground">{AUTOMATION_RULES_NOTE}</p>
          <p className="text-xs text-muted-foreground">{DEMO_EXTENSION_NOTE}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
