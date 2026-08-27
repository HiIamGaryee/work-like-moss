import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DatasetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full max-w-md" />
      ))}
    </div>
  )
}

export function DatasetError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-muted-foreground" aria-hidden="true" />
          Dataset unavailable
        </CardTitle>
        <CardDescription>
          Make sure this file exists: public/data/culture-retention-dummy-data.xlsx
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
          {message}
        </pre>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}
