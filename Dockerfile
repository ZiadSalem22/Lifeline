# Lifeline production image — single container serving the API, the built web
# SPA, and the embedded MCP endpoint. Build context is the repo root.
# Multi-stage: install workspaces, build shared → server → web, then a slim
# runtime that runs the baseline migration and starts the server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_API_BASE_URL=/
RUN npm run build -w @lifeline/shared \
 && npm run build -w @lifeline/server \
 && VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    npm run build -w @lifeline/web \
 && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
# The migration runner (dist/infrastructure/db/migrate.js) resolves the SQL +
# journal relative to itself; tsc does not copy non-.ts files, so place them at
# the dist path the compiled code expects.
COPY --from=build /app/apps/server/src/infrastructure/db/migrations apps/server/dist/infrastructure/db/migrations
COPY --from=build /app/apps/web/dist apps/web/dist
ENV WEB_DIST_DIR=/app/apps/web/dist
EXPOSE 3000
USER node
# Migrations run first (idempotent baseline; adopts existing DBs), then the API.
CMD ["sh", "-c", "node apps/server/dist/infrastructure/db/migrate.js && node apps/server/dist/main.js"]
