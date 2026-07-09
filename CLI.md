# CLI Commands

The app is a Vite frontend **plus** a Node/Hono API server (`server/`) that talks
to Firestore. For anything that reads or writes data (catalog, advisors,
sessions, market-data autofill) you need both running.

## Running locally

Two terminals:

```bash
# 1) API server (port 8080) — first time only: authenticate to Firestore
gcloud auth application-default login   # one-time, opens a browser
cd server
npm install                             # first time only
npm run dev                             # tsx watch, http://localhost:8080

# 2) Frontend (port 5173) — proxies /api → :8080
npm run dev                             # http://localhost:5173
```

The frontend also runs without the server, but every data call will fail (the
stores fall back to bundled defaults, read-only).

## Frontend commands

- **Dev**: `npm run dev` — Vite dev server on `:5173` (proxies `/api` → `:8080`)
- **Build**: `npm run build` — typecheck + optimized production build (`dist/`)
- **Preview**: `npm run preview` — preview the production build locally
- **Typecheck**: `npm run typecheck` — TypeScript check, no emit

## Server commands (run inside `server/`)

- **Dev**: `npm run dev` — `tsx watch` on `:8080`
- **Build**: `npm run build` — `tsc` → `server/dist/`
- **Start**: `npm run start` — run the compiled server

## Deploy (Cloud Run)

```bash
npm run deploy
# → gcloud run deploy investor-profile --source . \
#     --project archetype-classifier --region us-central1 --allow-unauthenticated
```

One container builds the frontend + server and serves both from one origin.
Live at <https://investor-profile-41156376159.us-central1.run.app>.
