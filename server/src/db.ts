import { Firestore } from '@google-cloud/firestore'

// Firestore (GCP native). On Cloud Run the project + credentials come from the
// runtime service account automatically; locally, set FIRESTORE_EMULATOR_HOST to
// point at the gcloud emulator. projectId is still needed in both cases.
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'archetype-classifier'

export const db = new Firestore({ projectId, ignoreUndefinedProperties: true })

export const catalogCol = db.collection('catalog')
export const configCol = db.collection('config')
export const advisorsCol = db.collection('advisors')
export const clientsCol = db.collection('clients')
export const sessionsCol = db.collection('sessions')

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

export const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')
