# Imagem base já tem Chromium dependências — ideal pra Playwright self-host.
FROM mcr.microsoft.com/playwright:v1.60.0-noble AS base
ENV NODE_ENV=production
WORKDIR /app

# =========================
# Stage 1 — deps
# =========================
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# =========================
# Stage 2 — build
# =========================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variáveis necessárias em build-time (next vai inlinearas NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npm run build

# =========================
# Stage 3 — runner
# =========================
FROM base AS runner
ENV PORT=3000
EXPOSE 3000

# Cria user não-root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output do Next: server.js + node_modules runtime mínimo.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
