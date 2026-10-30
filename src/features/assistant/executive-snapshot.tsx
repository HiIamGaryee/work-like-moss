import type { ExecutiveSnapshotItem } from '@/features/assistant/assistant.types'
import { cn } from '@/lib/utils'

export function ExecutiveSnapshot({ items }: { items: ExecutiveSnapshotItem[] }) {
  return (
    <div className="divide-y">
      {items.map((item) => (
        <div key={item.label} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-1.5 rounded-full bg-muted-foreground/40',
                item.severity === 'attention' && 'bg-foreground',
                item.severity === 'positive' && 'bg-foreground/70',
              )}
              aria-hidden="true"
            />
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {item.label}
            </p>
          </div>
          <p className="mt-1.5 text-base font-semibold leading-5">{item.value}</p>
          {item.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  )
}
