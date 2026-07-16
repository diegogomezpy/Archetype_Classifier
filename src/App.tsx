import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './i18n/i18n'
import { ThemeProvider } from './lib/theme'
import { CatalogProvider } from './lib/catalog'
import { ArchetypeConfigProvider } from './lib/archetypeConfig'
import { RiskParamsProvider } from './lib/riskParamsConfig'
import { DirectoryProvider } from './lib/directory'
import LanguageToggle from './components/LanguageToggle'
import ThemeToggle from './components/ThemeToggle'
import TestFlowPage from './pages/TestFlowPage'
import AdvisorListPage from './pages/AdvisorListPage'
import AdvisorClientPage from './pages/AdvisorClientPage'
import AdvisorSessionPage from './pages/AdvisorSessionPage'
import AdminPage from './pages/AdminPage'
import AdminArchetypesPage from './pages/AdminArchetypesPage'
import AdminRiskPage from './pages/AdminRiskPage'
import AdminAdvisorsPage from './pages/AdminAdvisorsPage'

// Route shell. Hash routing keeps every route working on static hosting with no
// server rewrites. MVP: no logins anywhere — the advisor area is a one-click
// "who are you?" picker, the admin console is open.
//
//   #/                      client test
//   #/advisor               advisor's clients (picker if none selected)
//   #/advisor/client/:id    one client's session history
//   #/advisor/session/:id   one session's dashboard
//   #/admin                 instrument catalog
//   #/admin/archetypes      archetype vectors + model mixes
//   #/admin/advisors        advisor accounts
export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <DirectoryProvider>
        <ArchetypeConfigProvider>
          <RiskParamsProvider>
          <CatalogProvider>
            <div className="relative min-h-[100svh] w-full ground text-text">
              <HashRouter>
                <Routes>
                  <Route path="/" element={<TestFlowPage />} />
                  <Route path="/advisor" element={<AdvisorListPage />} />
                  <Route path="/advisor/client/:clientId" element={<AdvisorClientPage />} />
                  <Route path="/advisor/session/:id" element={<AdvisorSessionPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/archetypes" element={<AdminArchetypesPage />} />
                  <Route path="/admin/risk" element={<AdminRiskPage />} />
                  <Route path="/admin/advisors" element={<AdminAdvisorsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </HashRouter>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </CatalogProvider>
          </RiskParamsProvider>
        </ArchetypeConfigProvider>
      </DirectoryProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
