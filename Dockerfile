# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund --ignore-scripts

COPY index.html tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js components.json ./
COPY src ./src
COPY public ./public

RUN npm run build

# ── Stage 2: Production server ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy root package.json (needed for npm start)
COPY package*.json ./

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --no-audit --no-fund --omit=dev --ignore-scripts

# Copy backend source
COPY backend ./backend

# Copy built frontend into dist/ (backend serves it as static files)
COPY --from=frontend-builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S tradeflow && \
    adduser -S -u 1001 -G tradeflow tradeflow && \
    chown -R tradeflow:tradeflow /app
USER tradeflow

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "backend/src/server.js"]
