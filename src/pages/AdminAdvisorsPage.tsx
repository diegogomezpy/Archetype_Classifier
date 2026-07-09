import { useEffect, useMemo, useState } from 'react'
import { useDirectory, type Advisor, type Client } from '../lib/directory'
import { api } from '../lib/api'
import { useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const inputCls =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text shadow-soft outline-none transition-shadow placeholder:text-muted/60 focus:ring-2 focus:ring-teal/40'
const labelCls = 'mb-1.5 block text-xs font-medium text-muted'

export default function AdminAdvisorsPage() {
  const t = useT()
  const { advisors, addAdvisor, updateAdvisor, removeAdvisor } = useDirectory()
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    let alive = true
    api
      .get<Client[]>('/clients')
      .then((c) => alive && setClients(c ?? []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const clientCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of clients) map[c.advisorId] = (map[c.advisorId] ?? 0) + 1
    return map
  }, [clients])

  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const submitAdd = () => {
    if (!name.trim()) return
    addAdvisor(name)
    setName('')
  }

  const startEdit = (a: Advisor) => {
    setEditingId(a.id)
    setEditName(a.name)
  }

  const saveEdit = (a: Advisor) => {
    if (!editName.trim()) return
    updateAdvisor({ ...a, name: editName.trim() })
    setEditingId(null)
  }

  const handleDelete = (a: Advisor) => {
    if (!window.confirm(t.adminAdvisors.deleteConfirm(a.name))) return
    removeAdvisor(a.id)
    if (editingId === a.id) setEditingId(null)
  }

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <AdminNav />

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">
          {t.adminAdvisors.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {t.adminAdvisors.subtitle}
        </p>

        {/* Add form */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={labelCls}>{t.adminAdvisors.name}</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
              />
            </div>
            <button
              type="button"
              onClick={submitAdd}
              disabled={!name.trim()}
              className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              + {t.adminAdvisors.add}
            </button>
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-muted tnum">
          {t.adminAdvisors.count(advisors.length)}
        </p>

        {advisors.length === 0 && (
          <p className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted shadow-soft">
            {t.adminAdvisors.empty}
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {advisors.map((a) => (
            <li key={a.id}>
              {editingId === a.id ? (
                <div className="flex items-center gap-3 rounded-2xl border border-teal/30 bg-surface p-4 shadow-soft">
                  <input
                    className={inputCls}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(a)}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:text-text"
                  >
                    {t.adminAdvisors.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(a)}
                    className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white shadow-soft"
                  >
                    {t.adminAdvisors.save}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-text">{a.name}</span>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {t.adminAdvisors.clients(clientCount[a.id] ?? 0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text"
                  >
                    {t.adminAdvisors.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted/60 transition-colors hover:bg-red/10 hover:text-red"
                  >
                    {t.adminAdvisors.delete}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
