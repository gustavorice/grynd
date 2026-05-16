# Grynd — Prospecção local em escala

SaaS de prospecção de leads locais no Brasil. Multi-fonte, multi-tenant, com
quota por leads e billing Stripe.

> **Para quem retoma o projeto depois de uma pausa**: o
> [Status atual & próximos passos](#-status-atual-do-mvp) tem tudo que falta.

---

## Visão geral

- **Domínio**: https://grynd.com.br (Vercel Pro)
- **Repo**: https://github.com/gustavorice/grynd
- **Stack**: Next.js 15 (App Router) · TypeScript · Drizzle ORM · Neon Postgres · Clerk · Stripe · Upstash Redis · Playwright (scraping)
- **Hosting**: Vercel Pro · DNS GoDaddy

---

## Arquitetura

### Coleta de leads (multi-fonte em paralelo)

Quando user busca, o backend dispara em paralelo:

1. **Google Places API** (`lib/providers/google.ts`) — só se `GOOGLE_PLACES_API_KEY` setado. $200/mês free credit.
2. **OpenStreetMap / Overpass** (`lib/providers/osm.ts`) — gratuito, cobertura limitada no BR mas funcional.
3. **Google Maps via Playwright** (`lib/providers/google-maps-scrape.ts`) — só no modo `deep`. Frágil em Vercel.
4. **SerpAPI** (`lib/providers/serpapi.ts`) — só se `SERPAPI_KEY` setado. Plug-and-play, $50/mês.

Os resultados são mergeados, deduplicados por nome+coordenadas, e truncados ao limite da quota do usuário.

### Quota e billing

- Cada **lead retornado** consome 1 da quota mensal (não cada busca).
- Free: 30 leads/mês · Pro: 3.500 · Agência: 25.000.
- Cache de 8min por (niche+location) é gratuito.
- `consumeSearch()` é **atômico via SQL** — race-safe.
- Add-on (+200 leads/R$20) só pro Pro. Não expira.

### Multi-tenancy

- Todas queries em `lib/*` filtram por `userId` (auditado).
- Schema em `lib/db/schema.ts`: `users`, `subscriptions`, `search_quota`,
  `addon_purchases`, `search_history`, `leads`, `company_profile`,
  `stripe_events`.

### Auth (Clerk)

- `middleware.ts` define rotas públicas/privadas.
- `getOrSyncUser()` cria o user no DB no primeiro request.
- Sign-in/up em `/sign-in` e `/sign-up`.

### Stripe

- Checkout subscription pro Pro/Agência: `/api/stripe/checkout`.
- Checkout one-time pro add-on: `/api/stripe/addon`.
- Portal de gerenciamento: `/api/stripe/portal`.
- Webhook: `/api/stripe/webhook` — valida signature + idempotência em `stripe_events`.
- Sync manual (fallback se webhook falhar): `/api/stripe/sync`.

---

## Estrutura de pastas

```
app/
  _components/          # Componentes client compartilhados
    LandingNav.tsx
    SupportWidget.tsx
    WelcomeModal.tsx
    ClerkBadgeKiller.tsx
  api/
    cron/reset-quotas/  # Cron mensal (Vercel)
    debug/scrape/       # Diagnóstico Playwright em prod
    enrich/             # Enriquece um lead específico
    health/             # Public health-check
    leads/              # CRUD de leads salvos
    me/                 # Sessão atual (user + plan + quota)
    profile/            # Perfil da empresa do user
    search/             # Busca multi-fonte
    send-whatsapp/      # WhatsApp share-link ou Cloud API
    stripe/{checkout,addon,portal,webhook,sync}/
  app/page.tsx          # Dashboard autenticado
  legal/                # Termos + Privacidade (LGPD)
  pricing/              # Página pública de planos
  sign-{in,up}/         # Páginas Clerk wrapped
  layout.tsx            # Root layout com ClerkProvider
  page.tsx              # Landing pública

lib/
  auth.ts               # Helpers Clerk + sync user
  db/{schema.ts,client.ts}
  diagnose.ts           # Score + porte do lead
  enrich.ts             # Extrai contatos de site
  niches.ts             # Catálogo central de 60+ nichos + fallback
  phone.ts              # Normaliza telefone BR + valida DDD ANATEL
  plans.ts              # Definição dos 3 planos + add-on
  profile.ts            # Perfil da empresa
  providers/
    browser.ts          # launchBrowser() — detecta serverless vs local
    google.ts           # Google Places API
    google-maps-scrape.ts # Playwright + @sparticuz/chromium
    osm.ts              # Overpass + Nominatim
    serpapi.ts          # SerpAPI HTTP
  quota.ts              # consumeSearch + applyPlanChange
  rate-limit.ts         # Upstash + enforceApiLimit helper
  search-cache.ts       # In-memory cache (8min TTL)
  store.ts              # CRUD leads no Postgres
  stripe.ts             # Stripe client (lazy)
  types.ts              # Lead, LeadSource, etc.

drizzle/                # Migrations geradas
public/                 # /grynd-logo.png
```

---

## Como rodar localmente

```bash
# 1. Variáveis
cp .env.example .env.local
# Preenche todas as keys (Neon, Clerk, Stripe, Upstash, etc.)

# 2. Dependências
npm install

# 3. Schema do banco
npm run db:push       # ou db:migrate se já há migrations

# 4. Dev server
npm run dev           # http://localhost:3000
```

### Pra testar webhook Stripe localmente

```bash
# Em outro terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Pega o whsec_xxx que ele imprime e cola em STRIPE_WEBHOOK_SECRET
```

### Pra testar Playwright localmente

Requer Chrome ou Edge instalado em path padrão Windows/Mac/Linux —
`lib/providers/browser.ts` detecta.

---

## Decisões importantes (porque é assim)

| Decisão | Justificativa |
|---------|---------------|
| **Quota por LEAD, não por busca** | Mais justo — uma busca pode trazer 1 ou 100 leads. |
| **Cache hit não consome quota** | Mesma busca em 8min é o mesmo dataset; cobrar duas vezes seria sacanagem. |
| **Catálogo central de nichos** (`lib/niches.ts`) | Antes cada provider tinha aliases próprios → bug. Hoje fonte única. |
| **`consumeSearch` atômico via SQL** | Race-safe. Duas requests paralelas pelo último crédito: só uma vence. |
| **`getOrSyncUser` em toda rota privada** | First-login automático. Cria row em `users` na primeira request. |
| **Stripe webhook idempotente** | `stripe_events` table previne reprocessamento. |
| **`success_url = /app?billing=success`** | Antes era `/` (landing). Aí o `bootstrapAndSync()` não rodava. |
| **Sem cor de destaque (preto/branco puro)** | Identidade do produto. Hierarquia por peso, não por cor. |
| **Modal de welcome após checkout** | UX premium pra confirmar compra bem-sucedida. |
| **Playwright em Vercel** | Frágil. Mitigação: SerpAPI quando crescer ou Fly.io worker dedicado. |
| **Vercel Pro obrigatório** | Vercel Hobby proíbe uso comercial (licença). |

---

## 📊 Status atual do MVP

### ✅ Pronto e em produção

- Domínio `grynd.com.br` com SSL
- Auth Clerk (dev mode) + sign-in/up funcionais
- Stripe Test mode com 3 produtos + webhook configurado
- Quota por leads atômica
- Landing + Pricing + Legal (Termos + Privacidade)
- Dashboard com busca, filtros, export CSV, configurações
- WhatsApp share-link (Cloud API só pra Agência)
- Cron mensal de reset de quotas
- SEO básico (robots.txt + sitemap.xml)
- Widget de suporte FAQ
- Modal premium pós-checkout
- **Segurança**: rate limit em todas rotas autenticadas, CSP, IDOR auditado, sem XSS, headers de segurança completos

### 🟡 Configurado mas precisa ativação

- Sentry pra erros em produção (precisa criar conta + setar `SENTRY_DSN`)
- Resend pra email transacional (precisa criar conta + verificar domínio)
- Vercel Analytics (1 click no Vercel dashboard)
- WhatsApp Cloud API (precisa verificar negócio no Meta — pode levar dias)

### 🔴 Pendente pra cobrar de verdade

1. **Clerk Production instance** — hoje aparece "Development mode" warning
   - Dashboard → Production tab → criar
   - Pega `pk_live_*` + `sk_live_*` → setar nas envs do Vercel
   - Adicionar `grynd.com.br` como domain
2. **Stripe Live mode**
   - Criar mesmos 3 produtos em Live (Pro R$ 59,90, Agência R$ 199,90, Addon R$ 20)
   - Pegar `sk_live_*` + 3 `price_live_*`
   - Criar webhook live em `grynd.com.br/api/stripe/webhook` → `whsec_live_*`
   - Atualizar envs no Vercel
3. **Rotacionar todas as keys de dev** que foram compartilhadas em chat
4. **CNPJ/MEI ativo** pra payouts do Stripe BR
5. **Stripe Tax ou Asaas** pra emitir NF automaticamente

### 🟢 Nice-to-have (post-launch)

- Mobile responsivo no `/app` (landing já é)
- Onboarding tour no primeiro login
- Cobertura de busca em nichos raros (Apify Google Maps OU Fly.io worker)
- RLS no Postgres (defesa em profundidade contra IDOR)
- 2FA no Clerk
- Cache compartilhado entre users

---

## Variáveis de ambiente

Documentadas em `.env.example`. Resumo:

```
NEXT_PUBLIC_APP_URL              # https://grynd.com.br
DATABASE_URL                     # Neon Postgres (pooled)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_URL
NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_FALLBACK_REDIRECT_URL
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_PRO_MONTHLY         # price_xxx
STRIPE_PRICE_AGENCY_MONTHLY      # price_xxx
STRIPE_PRICE_ADDON_200           # price_xxx
STRIPE_WEBHOOK_SECRET            # whsec_xxx
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CRON_SECRET                      # qualquer string aleatória (cron auth)
GOOGLE_PLACES_API_KEY            # opcional, $200/mês free
SERPAPI_KEY                      # opcional, scraping robusto
WHATSAPP_*                       # opcional, só pra Agência
```

---

## Comandos úteis

```bash
npm run dev              # dev local
npm run build            # produção local
npm run db:generate      # gera migration SQL
npm run db:migrate       # aplica migrations
npm run db:push          # push direto (dev only)
npm run db:studio        # admin DB local

git push origin main     # auto-deploy na Vercel

# Acessar Vercel logs
vercel logs grynd
```

---

## Planos e preços (test mode atual)

| Plano | Preço/mês | Leads | AI Insights | Export | WhatsApp | API |
|-------|-----------|-------|-------------|--------|----------|-----|
| Free | R$ 0 | 30 | 0 | — | share link | — |
| Pro | R$ 59,90 | 3.500 | 10 | CSV | share link | — |
| Agência | R$ 199,90 | 25.000 | ilimitado | CSV | Cloud API | ✓ |

Add-on: +200 leads = R$ 20 (one-time, só Pro)

Custo estimado pra operar: ~$25-50/mês fixos (Fly.io / Vercel Pro / Neon Pro
quando crescer). Margem positiva com 2-3 Pro users.

---

## Convenções de código

- TypeScript estrito · `npx tsc --noEmit` obrigatório passar antes de commit
- Zod nas rotas de API pra validação de input
- Drizzle ORM — nunca SQL cru (exceto `sql` helper pra atomic updates)
- `console.error` no servidor pra erros que merecem investigação
- Comentários em PT-BR (consistente com a copy do produto)
- Commits convencionais (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`,
  `security:`)

---

## Contato

- E-mail: contato@grynd.com.br
- Stripe Dashboard: https://dashboard.stripe.com
- Clerk Dashboard: https://dashboard.clerk.com
- Neon Console: https://console.neon.tech
- Upstash Console: https://console.upstash.com
- Vercel Dashboard: https://vercel.com/grynd/grynd
