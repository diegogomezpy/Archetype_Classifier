import type { DashboardData } from './scoring'

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------
// A completed test is saved as a SessionRecord so the advisor route can list
// and reopen past client sessions. The store is behind an interface so the
// backing can be swapped (Phase 1: localStorage; Phase 2: Firestore) without
// touching any UI code. All methods are async to match the remote impl.

// Slim per-round answer — enough to re-score a session later (e.g. after a
// config change) by rehydrating rounds from ROUNDS by id.
export type SessionAnswer = { roundId: number; allocX: number }

// NOTE: the drawn game P&L ("your run") is deliberately NOT persisted — it's a
// vanity metric for client engagement, not profile data.
export type SessionRecord = DashboardData & {
  id: string
  createdAt: string // ISO timestamp
  clientLabel: string | null // the name the client entered at the start
  advisorId: string | null // the advisor this session is linked to (if any)
  clientId: string | null // the client record replays accumulate under (if any)
  answers: SessionAnswer[]
}

export type NewSession = Omit<SessionRecord, 'id' | 'createdAt'>

export interface SessionStore {
  saveSession(session: NewSession): Promise<SessionRecord>
  /** Newest first. */
  listSessions(): Promise<SessionRecord[]>
  getSession(id: string): Promise<SessionRecord | null>
  deleteSession(id: string): Promise<void>
}

// ---------------------------------------------------------------------------
// localStorage implementation (Phase 1 — single-browser persistence)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ip_sessions_v1'

function readAll(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : []
  } catch {
    return [] // corrupted or unavailable storage — treat as empty
  }
}

function writeAll(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    /* ignore (private mode, quota) — the session still renders in-memory */
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

class LocalSessionStore implements SessionStore {
  async saveSession(session: NewSession): Promise<SessionRecord> {
    const record: SessionRecord = {
      ...session,
      id: makeId(),
      createdAt: new Date().toISOString(),
    }
    writeAll([record, ...readAll()])
    return record
  }

  async listSessions(): Promise<SessionRecord[]> {
    return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return readAll().find((s) => s.id === id) ?? null
  }

  async deleteSession(id: string): Promise<void> {
    writeAll(readAll().filter((s) => s.id !== id))
  }
}

// Single app-wide store instance. Phase 2 swaps this for the Firestore-backed
// implementation (behind the same interface).
const store: SessionStore = new LocalSessionStore()

export function getSessionStore(): SessionStore {
  return store
}
