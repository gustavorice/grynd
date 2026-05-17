/**
 * Hook do Next.js pra inicializar Sentry no boot do servidor.
 *
 * `register()` roda uma vez quando o server starta — escolhe o config certo
 * com base no runtime (Node.js pras API routes, Edge pro middleware Clerk).
 *
 * `onRequestError` captura erros que escapam de Server Components / route
 * handlers e não foram pegos pelo `safeError`.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
