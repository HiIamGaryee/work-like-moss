import { Navigate, Route, Routes } from 'react-router-dom'
import { RoleRouteGuard } from '@/components/role-route-guard'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { ActionsPage } from '@/pages/actions-page'
import { AskWorkLikeMossPage } from '@/pages/ask-work-like-moss-page'
import { AboutMvpPage } from '@/pages/about-mvp-page'
import { AutomationsPage } from '@/pages/automations-page'
import { EmployeesPage } from '@/pages/employees-page'
import { ImpactPage } from '@/pages/impact-page'
import { InsightAnalysisPage } from '@/pages/insight-analysis-page'
import { PatternInsightsPage } from '@/pages/pattern-insights-page'
import { OverviewPage } from '@/pages/overview-page'
import { FaqPage } from '@/pages/faq-page'
import { LoginPage } from '@/pages/login-page'
import { DemoNotesPage } from '@/pages/demo-notes-page'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="demo-notes" element={<DemoNotesPage />} />
      <Route element={<RoleRouteGuard />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="ask" element={<AskWorkLikeMossPage />} />
          <Route path="about" element={<AboutMvpPage />} />
          <Route path="demo-guide" element={<AboutMvpPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="insights" element={<PatternInsightsPage />} />
          <Route path="insights/:insightId" element={<InsightAnalysisPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="impact" element={<ImpactPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
