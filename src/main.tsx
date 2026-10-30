import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import { DemoRoleProvider } from '@/hooks/use-demo-role'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoRoleProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DemoRoleProvider>
  </StrictMode>,
)
