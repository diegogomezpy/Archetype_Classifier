# Single container for Cloud Run: the Node API server (server/) serves both the
# built Vite app and the /api routes from one origin.
# Deploy:  gcloud run deploy investor-profile --source . --region us-central1

# ---- build: frontend (Vite → /app/dist) then server (tsc → /app/server/dist) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build
WORKDIR /app/server
RUN npm ci && npm run build

# ---- runtime: Node server with production deps only ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_ROOT=web
# Server production dependencies.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
# Compiled server + the built frontend it serves.
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/dist ./web
# Cloud Run sends traffic to $PORT (default 8080); the server reads it.
EXPOSE 8080
CMD ["node", "dist/index.js"]
