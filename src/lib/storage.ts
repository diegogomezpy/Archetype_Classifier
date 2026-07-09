import type { DashboardData } from './scoring'
import { api } from './api'

// ---------------------------------------------------------------------------
// Session persistence (backend API → Firestore)
// ---------------------------------------------------------------------------
// A completed test is submitted to the server, which finds-or-creates the client
// (advisor + name) and stores the session linked to both. The drawn game P&L is
// deliberately NOT part of the record — it's an engagement metric, not profile
// data.

export type SessionAnswer = { roundId: number; allocX: number }

export type SessionRecord = DashboardData & {
  id: string
  createdAt: string
  clientLabel: string | null
  advisorId: string | null
  clientId: string | null
  answers: SessionAnswer[]
}

// What the client submits at the end of a test. The server links + stamps the
// rest (client record, ids, createdAt).
export type SessionSubmission = DashboardData & {
  advisorId: string | null
  clientName: string | null
  answers: SessionAnswer[]
}

export type SessionFilter = { advisorId?: string; clientId?: string }

export interface SessionStore {
  submitSession(session: SessionSubmission): Promise<SessionRecord>
  listSessions(filter?: SessionFilter): Promise<SessionRecord[]>
  getSession(id: string): Promise<SessionRecord | null>
  deleteSession(id: string): Promise<void>
}

class ApiSessionStore implements SessionStore {
  async submitSession(session: SessionSubmission): Promise<SessionRecord> {
    return api.post<SessionRecord>('/sessions', session)
  }
  async listSessions(filter?: SessionFilter): Promise<SessionRecord[]> {
    const q = new URLSearchParams()
    if (filter?.advisorId) q.set('advisorId', filter.advisorId)
    if (filter?.clientId) q.set('clientId', filter.clientId)
    const qs = q.toString()
    return api.get<SessionRecord[]>(`/sessions${qs ? `?${qs}` : ''}`)
  }
  async getSession(id: string): Promise<SessionRecord | null> {
    try {
      return await api.get<SessionRecord | null>(`/sessions/${id}`)
    } catch {
      return null
    }
  }
  async deleteSession(id: string): Promise<void> {
    await api.del(`/sessions/${id}`)
  }
}

const store: SessionStore = new ApiSessionStore()

export function getSessionStore(): SessionStore {
  return store
}
