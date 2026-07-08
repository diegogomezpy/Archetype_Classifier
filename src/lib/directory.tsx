import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Advisor / client directory
// ---------------------------------------------------------------------------
// Advisors are created by the admin; clients belong to exactly one advisor and
// are matched on (advisorId + normalized name) so replays re-link to the same
// client record. An advisor "logs in" (select account + passcode) and then only
// sees their own clients.
//
// SECURITY NOTE: on the static (localStorage) build this is demo-grade — all
// data is readable in the browser, so the advisor scoping is functional, not
// enforced. Real isolation arrives with the Phase-2 backend (Firebase Auth +
// Firestore rules); this whole model carries over unchanged, only the storage
// and the access check move server-side.

export type Advisor = {
  id: string
  name: string
  passcode: string // may be empty (select-only login); demo-grade, plaintext
  createdAt: string
}

export type Client = {
  id: string
  advisorId: string
  name: string
  createdAt: string
}

// Device-remembered last client, for one-tap "continue as" on the intro.
export type LastClient = { advisorId: string; clientId: string; name: string }

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

// ── Persistence ──────────────────────────────────────────────────────────────

const ADVISORS_KEY = 'ip_advisors_v1'
const CLIENTS_KEY = 'ip_clients_v1'
const SESSION_KEY = 'ip_advisor_session_v1' // logged-in advisorId
const LAST_CLIENT_KEY = 'ip_last_client_v1'

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore (quota/private mode) */
  }
}
function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

type DirectoryContextValue = {
  advisors: Advisor[]
  clients: Client[]
  // admin
  addAdvisor: (name: string, passcode: string) => void
  updateAdvisor: (advisor: Advisor) => void
  removeAdvisor: (id: string) => void
  // client flow
  findOrCreateClient: (advisorId: string, name: string) => Client
  clientsForAdvisor: (advisorId: string) => Client[]
  // advisor auth (demo-grade)
  loggedInAdvisorId: string | null
  login: (advisorId: string, passcode: string) => boolean
  logout: () => void
  // device memory
  lastClient: LastClient | null
  rememberClient: (last: LastClient) => void
  forgetClient: () => void
}

const DirectoryContext = createContext<DirectoryContextValue>({
  advisors: [],
  clients: [],
  addAdvisor: () => {},
  updateAdvisor: () => {},
  removeAdvisor: () => {},
  findOrCreateClient: () => ({ id: '', advisorId: '', name: '', createdAt: '' }),
  clientsForAdvisor: () => [],
  loggedInAdvisorId: null,
  login: () => false,
  logout: () => {},
  lastClient: null,
  rememberClient: () => {},
  forgetClient: () => {},
})

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [advisors, setAdvisors] = useState<Advisor[]>(() => readJSON<Advisor[]>(ADVISORS_KEY, []))
  const [clients, setClients] = useState<Client[]>(() => readJSON<Client[]>(CLIENTS_KEY, []))
  const [loggedInAdvisorId, setLoggedIn] = useState<string | null>(() =>
    readJSON<string | null>(SESSION_KEY, null),
  )
  const [lastClient, setLastClient] = useState<LastClient | null>(() =>
    readJSON<LastClient | null>(LAST_CLIENT_KEY, null),
  )

  useEffect(() => writeJSON(ADVISORS_KEY, advisors), [advisors])
  useEffect(() => writeJSON(CLIENTS_KEY, clients), [clients])

  const value = useMemo<DirectoryContextValue>(() => {
    return {
      advisors,
      clients,
      addAdvisor: (name, passcode) =>
        setAdvisors((prev) => [
          ...prev,
          {
            id: makeId('adv'),
            name: name.trim(),
            passcode: passcode.trim(),
            createdAt: new Date().toISOString(),
          },
        ]),
      updateAdvisor: (advisor) =>
        setAdvisors((prev) => prev.map((a) => (a.id === advisor.id ? advisor : a))),
      removeAdvisor: (id) => setAdvisors((prev) => prev.filter((a) => a.id !== id)),
      findOrCreateClient: (advisorId, name) => {
        const key = normalize(name)
        const existing = clients.find((c) => c.advisorId === advisorId && normalize(c.name) === key)
        if (existing) return existing
        const created: Client = {
          id: makeId('cli'),
          advisorId,
          name: name.trim(),
          createdAt: new Date().toISOString(),
        }
        setClients((prev) => [...prev, created])
        return created
      },
      clientsForAdvisor: (advisorId) => clients.filter((c) => c.advisorId === advisorId),
      loggedInAdvisorId,
      login: (advisorId, passcode) => {
        const advisor = advisors.find((a) => a.id === advisorId)
        if (!advisor) return false
        if (advisor.passcode && advisor.passcode !== passcode.trim()) return false
        setLoggedIn(advisorId)
        writeJSON(SESSION_KEY, advisorId)
        return true
      },
      logout: () => {
        setLoggedIn(null)
        remove(SESSION_KEY)
      },
      lastClient,
      rememberClient: (last) => {
        setLastClient(last)
        writeJSON(LAST_CLIENT_KEY, last)
      },
      forgetClient: () => {
        setLastClient(null)
        remove(LAST_CLIENT_KEY)
      },
    }
  }, [advisors, clients, loggedInAdvisorId, lastClient])

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>
}

export function useDirectory(): DirectoryContextValue {
  return useContext(DirectoryContext)
}
