/**
 * Sentry — runtime Node.js (API routes, server components, getOrSyncUser, etc.)
 *
 * Carregado por `instrumentation.ts` quando NEXT_RUNTIME === "nodejs".
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Traces — começa baixo pra não estourar quota free (5k transactions/mês).
  // Sobe pra 1.0 em ambientes preview pra debugar.
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Mantém logs no console também (não silencia o que já existe no codebase).
  debug: false,

  // Em produção, ignora erros esperados que não merecem alerta.
  ignoreErrors: [
    // Clerk lança quando user nao autenticado — esperado, ja tratamos no safeError.
    "Nao autenticado.",
    "Unauthorized",
    // QuotaError — esperado, retorna 402 pro user fazer upgrade.
    "Limite de leads mensais atingido",
    "Limite de AI insights atingido"
  ],

  // Captura PII só em prod (pra debug de erro real).
  // Email e IP ajudam a correlacionar com Stripe/Clerk dashboards.
  sendDefaultPii: true,

  environment: process.env.VERCEL_ENV ?? "development"
});
