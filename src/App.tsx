import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './i18n/i18n'
import { ThemeProvider } from './lib/theme'
import { CatalogProvider } from './lib/catalog'
import { RiskBandsProvider } from './lib/bandConfig'
import { QuestionnaireProvider } from './lib/questionnaire'
import { RiskLevelsProvider } from './lib/riskLevelsConfig'
import { PortfolioModelProvider } from './lib/portfolioModelConfig'
import { DirectoryProvider } from './lib/directory'
import TestFlowPage from './pages/TestFlowPage'
import AdvisorListPage from './pages/AdvisorListPage'
import AdvisorClientPage from './pages/AdvisorClientPage'
import AdvisorSessionPage from './pages/AdvisorSessionPage'
import AdminPage from './pages/AdminPage'
import AdminBandsPage from './pages/AdminBandsPage'
import AdminQuestionsPage from './pages/AdminQuestionsPage'
import AdminRiskPage from './pages/AdminRiskPage'
import AdminPortfolioPage from './pages/AdminPortfolioPage'
import AdminScreenerPage from './pages/AdminScreenerPage'
import AdminAdvisorsPage from './pages/AdminAdvisorsPage'

// Route shell. Hash routing keeps every route working on static hosting with no
// server rewrites. MVP: no logins anywhere — the advisor area is a one-click
// "who are you?" picker, the admin console is open.
//
//   #/                      client questionnaire
//   #/advisor               advisor's clients (picker if none selected)
//   #/advisor/client/:id    one client's session history
//   #/advisor/session/:id   one session's portfolio
//   #/admin                 instrument catalog
//   #/admin/screener        trait screener → which instruments advisors see
//   #/admin/questions       questionnaire editor
//   #/admin/bands           risk bands (1–5 presets)
//   #/admin/risk            instrument risk model
//   #/admin/advisors        advisor accounts
export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <DirectoryProvider>
        <QuestionnaireProvider>
        <RiskBandsProvider>
          <RiskLevelsProvider>
          <PortfolioModelProvider>
          <CatalogProvider>
            <div className="relative min-h-[100svh] w-full ground text-text">
              <HashRouter>
                <Routes>
                  <Route path="/" element={<TestFlowPage />} />
                  <Route path="/advisor" element={<AdvisorListPage />} />
                  <Route path="/advisor/client/:clientId" element={<AdvisorClientPage />} />
                  <Route path="/advisor/session/:id" element={<AdvisorSessionPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/screener" element={<AdminScreenerPage />} />
                  <Route path="/admin/questions" element={<AdminQuestionsPage />} />
                  <Route path="/admin/bands" element={<AdminBandsPage />} />
                  <Route path="/admin/risk" element={<AdminRiskPage />} />
                  <Route path="/admin/portfolio" element={<AdminPortfolioPage />} />
                  <Route path="/admin/advisors" element={<AdminAdvisorsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </HashRouter>
            </div>
          </CatalogProvider>
          </PortfolioModelProvider>
          </RiskLevelsProvider>
        </RiskBandsProvider>
        </QuestionnaireProvider>
      </DirectoryProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
