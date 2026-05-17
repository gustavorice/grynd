import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { QuotaError } from "@/lib/quota";

/**
 * Resposta de erro padronizada — evita vazar mensagens cruas do Postgres,
 * Stripe, Zod ou bibliotecas internas pro cliente.
 *
 * Regras:
 *  - AuthError, QuotaError, ZodError → sao "domain errors", retornam mensagem
 *    amigavel + status especifico.
 *  - Qualquer outra coisa → log detalhado no server, mensagem generica pro cliente.
 *
 * Uso:
 *   try { ... } catch (error) { return safeError(error, "Erro ao salvar lead."); }
 */
export function safeError(error: unknown, fallbackMessage: string, fallbackStatus = 500) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof QuotaError) {
    return NextResponse.json(
      { error: error.message, plan: error.plan, remaining: error.remaining },
      { status: error.status }
    );
  }

  if (error instanceof z.ZodError) {
    const issue = error.errors[0];
    const field = issue?.path?.join(".") || "campo";
    const message = issue?.message?.includes("Required")
      ? `Campo obrigatório faltando: ${field}`
      : `Dados inválidos em ${field}: ${issue?.message ?? "valor não aceito"}`;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Erro inesperado — loga detalhado no server, retorna generico ao cliente.
  // (Sentry vai capturar isso quando o DSN estiver pluggado.)
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("[api] erro nao classificado:", detail);
  if (error instanceof Error && error.stack) {
    console.error(error.stack.split("\n").slice(0, 6).join("\n"));
  }

  return NextResponse.json({ error: fallbackMessage }, { status: fallbackStatus });
}

/**
 * Schema estrito de Lead pra entrada via API (POST/PATCH /api/leads).
 * Antes era z.custom que aceitava qualquer objeto — agora exige shape correta.
 *
 * Campos opcionais ficam opcionais; obrigatorios refletem o tipo Lead.
 */
export const LeadInputSchema = z.object({
  id: z.string().min(1).max(200),
  source: z.enum(["google_places", "google_maps_scrape", "openstreetmap"]),
  sourceId: z.string().max(200),
  name: z.string().min(1).max(200),
  category: z.string().max(120),
  niche: z.string().max(120),
  address: z.string().max(500),
  city: z.string().max(120),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  website: z.string().max(500).optional(),
  instagram: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  email: z.string().email().max(200).optional(),
  mapsUrl: z.string().max(1000).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  status: z.enum(["new", "saved", "sent", "contacted", "ignored"]),
  score: z.number().min(0).max(100),
  companySize: z.enum(["pequena", "media", "grande"]),
  diagnosis: z.string().max(2000),
  nextAction: z.string().max(2000),
  tags: z.array(z.string().max(60)).max(20),
  raw: z.record(z.unknown()).optional(),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40)
});
