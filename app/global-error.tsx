"use client";

/**
 * Global error boundary do App Router.
 *
 * Captura erros que escapam do render React (incluindo erros do root layout)
 * e reporta pro Sentry. Renderiza uma tela de fallback minima preto-e-branco.
 *
 * Atencao: precisa de tag <html> e <body> proprias — esse boundary substitui
 * o root layout quando dispara.
 */
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* statusCode 0 pra evitar mostrar mensagem genérica do Next; usamos o nosso layout */}
        <NextError statusCode={0} title="Algo deu errado." />
      </body>
    </html>
  );
}
