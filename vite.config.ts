import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// In production the Node server (server/) serves the built app and the API from
// the same origin, so base stays '/'. In dev, Vite serves the app on :5173 and
// proxies /api → an API server. Default is the local server on :8080; set
// API_PROXY to point at a deployed backend instead (e.g. the Cloud Run URL) when
// developing the frontend against real data.
// (read via globalThis so the app's tsconfig needn't pull in @types/node)
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
const apiProxy = env?.API_PROXY || 'http://localhost:8080'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
})
