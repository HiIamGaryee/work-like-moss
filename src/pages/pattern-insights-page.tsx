import { PatternOverview } from '@/components/insights/pattern-overview'
import { useHrAnalysis } from '@/hooks/use-hr-analysis'
import { InsightsPage } from '@/pages/insights-page'

/** Adds the Step 2 patterns to the existing Insights route and layout. */
export function PatternInsightsPage() {
  const { analysis } = useHrAnalysis()

  return (
    <div className="space-y-6">
      <InsightsPage />
      {analysis ? <PatternOverview analysis={analysis} /> : null}
    </div>
  )
}
