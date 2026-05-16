# Deploy — Grynd

Guia passo-a-passo do zero até produção no Fly.io.

## 1. Criar contas externas

- **Neon** (banco): https://neon.tech
- **Clerk** (auth): https://clerk.com
- **Stripe** (billing): https://stripe.com (começa em **Test mode**)
- **Upstash** (Redis): https://upstash.com
- **Fly.io** (hosting): https://fly.io

## 2. Configurar .env.local

Copia `.env.example` pra `.env.local` e preenche as chaves.

### Neon
1. New Project → escolhe região `us-east-2` (mais perto do Fly `gru`)
2. Copia o **Pooled connection string** (que termina em `?sslmode=require&pgbouncer=true`)
3. Cola em `DATABASE_URL`

### Clerk
1. Create application → habilita "Email" + "Google"
2. Copia `Publishable key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. Copia `Secret key` → `CLERK_SECRET_KEY`

### Stripe (Test mode)
1. No Dashboard → Products → Create product (3 vezes):

| Nome | Preço | Recorrência | Var de env |
|------|-------|-------------|------------|
| Pro Mensal | R$ 59,90 | Mensal | `STRIPE_PRICE_PRO_MONTHLY` |
| Agência Mensal | R$ 199,90 | Mensal | `STRIPE_PRICE_AGENCY_MONTHLY` |
| 200 buscas extras | R$ 20,00 | Avulso | `STRIPE_PRICE_ADDON_200` |

2. Copia o **Secret key** → `STRIPE_SECRET_KEY`
3. Webhook é configurado depois do primeiro deploy (precisa de URL pública). Por enquanto deixe `STRIPE_WEBHOOK_SECRET` vazio.

### Upstash
1. Create database → Redis → Region `sa-east-1` (São Paulo)
2. Copia REST URL → `UPSTASH_REDIS_REST_URL`
3. Copia REST Token → `UPSTASH_REDIS_REST_TOKEN`

## 3. Rodar migrations no Neon

```bash
npm run db:generate   # gera SQL em ./drizzle
npm run db:push       # aplica no Neon (alternativa: db:migrate)
```

## 4. Testar local

```bash
npm run dev
```

Acessa `http://localhost:3000` → vai pedir login. Cria conta no Clerk, deve voltar autenticado pro dashboard.

## 5. Deploy no Fly.io

### Setup uma vez
```bash
fly auth login
fly launch --no-deploy --copy-config   # cria app com nome único; edita fly.toml se quiser
```

### Configurar secrets (rodar pra cada uma das envs)
```bash
fly secrets set \
  DATABASE_URL="..." \
  CLERK_SECRET_KEY="..." \
  STRIPE_SECRET_KEY="..." \
  STRIPE_PRICE_PRO_MONTHLY="price_..." \
  STRIPE_PRICE_AGENCY_MONTHLY="price_..." \
  STRIPE_PRICE_ADDON_200="price_..." \
  UPSTASH_REDIS_REST_URL="..." \
  UPSTASH_REDIS_REST_TOKEN="..." \
  NEXT_PUBLIC_APP_URL="https://grynd.fly.dev" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
```

### Deploy
```bash
fly deploy
```

Depois do deploy passar, anota a URL pública (ex.: `https://grynd.fly.dev`).

## 6. Configurar Stripe Webhook

1. Dashboard Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://grynd.fly.dev/api/stripe/webhook`
3. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copia o **Signing secret** → `fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."`

## 7. Configurar Clerk Webhook (opcional — pra sincronizar perfil quando user edita no Clerk)

Não obrigatório no MVP. O `getOrSyncUser()` já cria o user no primeiro request.

## 8. Verificar

1. Acessa a URL → sign-up com novo usuário
2. Verifica `/api/me` retorna o plano `free`
3. Clica "Upgrade pra Pro" → checkout Stripe → completa com cartão de teste `4242 4242 4242 4242`
4. Volta pra `/?billing=success` → o badge no header deve mostrar "Pro 0/500"
5. Faz uma busca → contador sobe pra `1/500`
6. Confere no Stripe Dashboard que o webhook foi entregue com 200

## Custos fixos esperados

| Serviço | Custo/mês |
|---------|-----------|
| Fly.io (shared-cpu-1x, 1GB) | $5-10 |
| Neon Free → Pro quando precisar | $0 → $19 |
| Upstash Free | $0 |
| Clerk Free (até 10k MAU) | $0 |
| Stripe | 4,99% por transação (BR) |
| **Total mínimo** | **~$5-10/mês + taxa Stripe** |

## Operação

- Logs ao vivo: `fly logs`
- Restart: `fly machines restart`
- Console no app: `fly ssh console`
- Drizzle Studio (admin DB local): `npm run db:studio` (usa `DATABASE_URL` do .env)
- Stripe CLI pra testar webhook local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
