/**
 * Sentry — runtime Edge (middleware Clerk).
 *
 * Carregado por `instrumentation.ts` quando NEXT_RUNTIME === "edge".
 * Cobertura limitada — edge runtime tem APIs reduzidas.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  ignoreErrors: ["Nao autenticado.", "Unauthorized"],
  environment: process.env.VERCEL_ENV ?? "development"
});
