# CLI Commands

The app is a Vite frontend **plus** a Node/Hono API server (`server/`) that talks
to Firestore. Anything that reads or writes data — catalog, advisors, sessions,
config, market-data autofill — needs both running.

## Running locally

Two terminals:

```bash
# 1) API server (port 8080) — first time only, authenticate to Firestore
gcloud auth application-default login   # one-time, opens a browser
cd server
npm install                             # first time only
npm run dev                             # tsx watch, http://localhost:8080
```

```bash
# 2) Frontend (port 5173) — proxies /api → :8080
npm run dev                             # http://localhost:5173
```

To develop the frontend against a **deployed** backend instead of the local one,
set `API_PROXY` (see `vite.config.ts`):

```bash
API_PROXY=https://<your-cloud-run-url> npm run dev
```

The frontend runs on its own, but every data call fails. The providers now
distinguish that from an empty database: you'll see "could not reach the server"
with a retry, not a silent empty catalog.

> Firestore credentials require a live GCP project. The project this app used
> (`archetype-classifier`) has been **deleted** — see *Deploy* below.

### Preview servers

`.claude/launch.json` defines two:

| Name | Port | What |
|---|---|---|
| `investor-profile` | 5180 | Frontend only (`--port 5180`). No API — the catalog renders empty. |
| `web-live` | 5181 | Frontend with `API_PROXY` set to the **deployed** Cloud Run service. Was the fastest way to work against real data. |

`web-live` points at the deleted service, so it now serves the app shell with no
data. Update the `API_PROXY` URL in its `runtimeArgs` once a new backend is up.

## Frontend commands

- **Dev**: `npm run dev` — Vite dev server on `:5180`, proxies `/api` → `:8080`
- **Build**: `npm run build` — typecheck (`tsc --noEmit`) + production build to `dist/`
- **Preview**: `npm run preview` — serve the production build locally
- **Typecheck**: `npm run typecheck` — TypeScript check, no emit

## Server commands (run inside `server/`)

- **Dev**: `npm run dev` — `tsx watch` on `:8080`
- **Build**: `npm run build` — `tsc` → `server/dist/`
- **Start**: `npm run start` — run the compiled server

Typecheck the server separately — the root `tsc` doesn't cover it:

```bash
cd server && npx tsc --noEmit
```

## Deploy (Cloud Run)

```bash
npm run deploy
# → gcloud run deploy investor-profile --source . \
#     --project archetype-classifier --region us-central1 --allow-unauthenticated
```

One container builds the frontend + server and serves both from one origin.

> **The target project no longer exists.** `archetype-classifier` was deleted on
> 2026-07-27 (Cloud Run service, Firestore, both buckets, images, scheduler).
> Within ~30 days of that date the whole thing — data included — comes back with
> `gcloud projects undelete archetype-classifier`, then re-enable billing and
> re-run `npm run deploy`. After that window, follow *Bringing it back up* in
> the README and update the project id in `package.json`'s `deploy` script and
> in this file.

### Useful operational endpoints

| Endpoint | What |
|---|---|
| `GET /api/health` | Liveness |
| `GET /api/market-data/translate` | Spanish coverage report — spends no translation quota |
| `POST /api/market-data/refresh` | Daily Yahoo re-pull + translation sweep. Gated by `x-refresh-token` when `REFRESH_TOKEN` is set. |

### Environment variables

| Var | Where | Effect |
|---|---|---|
| `PORT` | server | Server port (default 8080) |
| `WEB_ROOT` | server | Directory the built frontend is served from (default `web`) |
| `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT` | server | Firestore project. Set automatically on Cloud Run. |
| `DOCS_BUCKET` | server | GCS bucket for instrument document attachments |
| `REFRESH_TOKEN` | server | Required `x-refresh-token` header value for `POST /api/market-data/refresh`. Set it in Cloud Run, never in the repo. |
| `TRANSLATE_CONTACT_EMAIL` | server | Raises the MyMemory translation cap from 5k to 50k words/day |
| `API_PROXY` | frontend dev | Proxy `/api` at a deployed backend instead of `localhost:8080` |
