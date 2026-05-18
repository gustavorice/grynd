import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let cached: { search?: Ratelimit; api?: Ratelimit } = {};

function tryRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Rate limit pra rotas de busca: 6 buscas por minuto por user.
 * Funciona como "burst control" — quota mensal trata o uso total.
 */
export function searchRateLimit(): Ratelimit | null {
  if (cached.search) return cached.search;
  const redis = tryRedis();
  if (!redis) return null;
  cached.search = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(6, "60 s"),
    analytics: true,
    prefix: "rl:search"
  });
  return cached.search;
}

/**
 * Rate limit genérico pras outras APIs: 60/min por user.
 */
export function apiRateLimit(): Ratelimit | null {
  if (cached.api) return cached.api;
  const redis = tryRedis();
  if (!redis) return null;
  cached.api = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    analytics: true,
    prefix: "rl:api"
  });
  return cached.api;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset: number;
};

export async function checkRate(
  limit: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limit) {
    // Em producao, faltar Upstash REST URL/TOKEN nao pode silenciosamente
    // desligar o rate limit — isso vira amplificacao perfeita. Em dev local
    // mantemos fail-open pra nao exigir Redis pro dev rodar nada.
    if (process.env.VERCEL_ENV === "production") {
      console.error("[rate-limit] PROD sem Upstash configurado — fail-closing");
      return { ok: false, remaining: 0, reset: Date.now() + 60_000 };
    }
    return { ok: true, remaining: -1, reset: 0 };
  }
  try {
    const result = await limit.limit(identifier);
    return { ok: result.success, remaining: result.remaining, reset: result.reset };
  } catch (error) {
    // Upstash indisponivel transiente: em prod fail-closed, em dev fail-open.
    console.error("[rate-limit] erro ao checar:", error);
    if (process.env.VERCEL_ENV === "production") {
      return { ok: false, remaining: 0, reset: Date.now() + 60_000 };
    }
    return { ok: true, remaining: -1, reset: 0 };
  }
}

import { NextResponse } from "next/server";

/**
 * Helper: aplica rate limit genérico em rotas autenticadas. Retorna null
 * se OK, ou um NextResponse 429 já formatado se exceder.
 *
 * Uso:
 *   const limited = await enforceApiLimit(user.id);
 *   if (limited) return limited;
 */
export async function enforceApiLimit(userId: string): Promise<NextResponse | null> {
  const rate = await checkRate(apiRateLimit(), `user:${userId}`);
  if (rate.ok) return null;
  return NextResponse.json(
    {
      error: "Muitas requisições em pouco tempo. Aguarde alguns segundos.",
      resetAt: rate.reset
    },
    { status: 429 }
  );
}
