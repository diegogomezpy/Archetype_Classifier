import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './i18n/i18n'
import { CatalogProvider } from './lib/catalog'
import { ArchetypeConfigProvider } from './lib/archetypeConfig'
import { DirectoryProvider } from './lib/directory'
import LanguageToggle from './components/LanguageToggle'
import TestFlowPage from './pages/TestFlowPage'
import AdvisorListPage from './pages/AdvisorListPage'
import AdvisorClientPage from './pages/AdvisorClientPage'
import AdvisorSessionPage from './pages/AdvisorSessionPage'
import AdminPage from './pages/AdminPage'
import AdminArchetypesPage from './pages/AdminArchetypesPage'
import AdminAdvisorsPage from './pages/AdminAdvisorsPage'

// Route shell. Hash routing keeps every route working on static hosting
// (GitHub Pages subpath) with no server rewrites.
//
//   #/                      client test (public)
//   #/advisor               advisor sign-in → their clients
//   #/advisor/client/:id    one client's session history (advisor)
//   #/advisor/session/:id   one session's two-panel dashboard (advisor)
//   #/admin                 instrument catalog (admin)
//   #/admin/archetypes      archetype vectors + model mixes (admin)
//   #/admin/advisors        advisor account management (admin)
export default function App() {
  return (
    <LanguageProvider>
      <DirectoryProvider>
        <ArchetypeConfigProvider>
          <CatalogProvider>
            <div className="relative min-h-[100svh] w-full bg-bg text-text">
              <HashRouter>
                <Routes>
                  <Route path="/" element={<TestFlowPage />} />
                  <Route path="/advisor" element={<AdvisorListPage />} />
                  <Route path="/advisor/client/:clientId" element={<AdvisorClientPage />} />
                  <Route path="/advisor/session/:id" element={<AdvisorSessionPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/archetypes" element={<AdminArchetypesPage />} />
                  <Route path="/admin/advisors" element={<AdminAdvisorsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </HashRouter>
              <LanguageToggle />
            </div>
          </CatalogProvider>
        </ArchetypeConfigProvider>
      </DirectoryProvider>
    </LanguageProvider>
  )
}
