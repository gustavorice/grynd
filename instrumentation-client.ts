/**
 * Sentry — browser (componentes React, client actions, etc.)
 *
 * Carregado automaticamente pelo Next.js no client bundle.
 * Substituiu o legado `sentry.client.config.ts` — esse novo nome é
 * compativel com Turbopack (Next 15.3+).
 *
 * Usa NEXT_PUBLIC_SENTRY_DSN porque precisa ser exposto ao browser.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance + replays só em prod, e em sample baixo.
  tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Session Replay — 0 em prod (cara de dinheiro), só replay quando dá erro.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.5 : 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false
    })
  ],

  debug: false,

  // Erros esperados que nao queremos alertar.
  ignoreErrors: [
    // ResizeObserver warnings — false positive
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Erros de rede causados por extension/adblock
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    // Clerk dispara isso em logout — esperado
    "ClerkRuntimeError"
  ],

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development"
});

// Hook necessario pra captura de navegacao client-side no App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
