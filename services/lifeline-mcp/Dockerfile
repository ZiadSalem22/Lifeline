FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    MCP_PORT=3010 \
    MCP_BIND_HOST=0.0.0.0

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src

USER node

EXPOSE 3010

CMD ["node", "src/index.js"]