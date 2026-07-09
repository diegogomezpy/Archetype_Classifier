import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'

// ---------------------------------------------------------------------------
// Advisor directory (backend-API backed)
// ---------------------------------------------------------------------------
// Advisors are created by the admin and persist in Firestore via the API.
// Clients belong to exactly one advisor and are matched on (advisorId +
// normalized name) so replays re-link to the same client record — but that
// find-or-create now happens SERVER-SIDE when a completed test is submitted, so
// the client no longer keeps a local client list. There are no logins (MVP):
// the Advisor tab is a one-click "who are you?" picker, remembered on-device.

export type Advisor = {
  id: string
  name: string
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

// ── Device-local persistence (advisor picker + last client only) ─────────────

const SESSION_KEY = 'ip_advisor_session_v1' // selected advisorId on this device
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
  loading: boolean
  // admin (optimistic + persisted via API)
  addAdvisor: (name: string) => void
  updateAdvisor: (advisor: Advisor) => void
  removeAdvisor: (id: string) => void
  // which advisor is using this device (one-click picker, no login)
  loggedInAdvisorId: string | null
  login: (advisorId: string) => void
  logout: () => void
  // device memory
  lastClient: LastClient | null
  rememberClient: (last: LastClient) => void
  forgetClient: () => void
}

const DirectoryContext = createContext<DirectoryContextValue>({
  advisors: [],
  loading: true,
  addAdvisor: () => {},
  updateAdvisor: () => {},
  removeAdvisor: () => {},
  loggedInAdvisorId: null,
  login: () => {},
  logout: () => {},
  lastClient: null,
  rememberClient: () => {},
  forgetClient: () => {},
})

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedInAdvisorId, setLoggedIn] = useState<string | null>(() =>
    readJSON<string | null>(SESSION_KEY, null),
  )
  const [lastClient, setLastClient] = useState<LastClient | null>(() =>
    readJSON<LastClient | null>(LAST_CLIENT_KEY, null),
  )

  useEffect(() => {
    let alive = true
    api
      .get<Advisor[]>('/advisors')
      .then((list) => alive && setAdvisors(list ?? []))
      .catch(() => alive && setAdvisors([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<DirectoryContextValue>(() => {
    return {
      advisors,
      loading,
      addAdvisor: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        // Optimistic: show a temp row, then reconcile with the server's record.
        const tempId = `tmp_${Date.now().toString(36)}`
        const temp: Advisor = { id: tempId, name: trimmed, createdAt: new Date().toISOString() }
        setAdvisors((prev) => [...prev, temp])
        void api
          .post<Advisor>('/advisors', { name: trimmed })
          .then((saved) => setAdvisors((prev) => prev.map((a) => (a.id === tempId ? saved : a))))
          .catch((e) => {
            console.warn('advisor add:', e)
            setAdvisors((prev) => prev.filter((a) => a.id !== tempId))
          })
      },
      updateAdvisor: (advisor) => {
        setAdvisors((prev) => prev.map((a) => (a.id === advisor.id ? advisor : a)))
        void api.put(`/advisors/${advisor.id}`, advisor).catch((e) => console.warn('advisor save:', e))
      },
      removeAdvisor: (id) => {
        setAdvisors((prev) => prev.filter((a) => a.id !== id))
        void api.del(`/advisors/${id}`).catch((e) => console.warn('advisor delete:', e))
      },
      loggedInAdvisorId,
      login: (advisorId) => {
        if (!advisors.some((a) => a.id === advisorId)) return
        setLoggedIn(advisorId)
        writeJSON(SESSION_KEY, advisorId)
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
  }, [advisors, loading, loggedInAdvisorId, lastClient])

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>
}

export function useDirectory(): DirectoryContextValue {
  return useContext(DirectoryContext)
}
