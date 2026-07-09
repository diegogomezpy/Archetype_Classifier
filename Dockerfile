# Frontend container for Cloud Run — build the Vite app, serve it with nginx.
# Deploy:  gcloud run deploy investor-profile --source . --region us-central1

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite reads VITE_FIREBASE_* from .env.production at build time (public config).
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Cloud Run sends traffic to $PORT (default 8080); nginx listens there.
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
