import { Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { ActionsPage } from '@/pages/actions-page'
import { AutomationsPage } from '@/pages/automations-page'
import { EmployeesPage } from '@/pages/employees-page'
import { ImpactPage } from '@/pages/impact-page'
import { InsightAnalysisPage } from '@/pages/insight-analysis-page'
import { PatternInsightsPage } from '@/pages/pattern-insights-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { OverviewPage } from '@/pages/overview-page'

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="insights" element={<PatternInsightsPage />} />
        <Route path="insights/:insightId" element={<InsightAnalysisPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="impact" element={<ImpactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
