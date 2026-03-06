FROM node:20-alpine AS client-build

WORKDIR /app/client

ARG BUILD_VITE_API_BASE_URL=/
ARG BUILD_LOCAL_MODE=1
ARG BUILD_VITE_AUTH0_DOMAIN=
ARG BUILD_VITE_AUTH0_CLIENT_ID=
ARG BUILD_VITE_AUTH0_AUDIENCE=
ARG BUILD_VITE_AUTH0_SCOPE=openid profile email offline_access

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN VITE_API_BASE_URL="$BUILD_VITE_API_BASE_URL" \
    VITE_AUTH_DISABLED="$BUILD_LOCAL_MODE" \
    VITE_AUTH0_DOMAIN="$BUILD_VITE_AUTH0_DOMAIN" \
    VITE_AUTH0_CLIENT_ID="$BUILD_VITE_AUTH0_CLIENT_ID" \
    VITE_AUTH0_AUDIENCE="$BUILD_VITE_AUTH0_AUDIENCE" \
    VITE_AUTH0_SCOPE="$BUILD_VITE_AUTH0_SCOPE" \
    npm run build

FROM node:20-alpine AS backend-deps

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package*.json ./backend/
COPY backend/data-source-migrations.js ./backend/
COPY backend/swagger.json ./backend/
COPY backend/public ./backend/public
COPY backend/scripts ./backend/scripts
COPY backend/src ./backend/src
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "scripts/start-container.js"]