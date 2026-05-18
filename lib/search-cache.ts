import type { Lead, LeadSource } from "@/lib/types";

type CachedEntry = {
  leads: Lead[];
  sources: Record<LeadSource, number>;
  expiresAt: number;
};

const TTL_MS = 8 * 60 * 1000;
const MAX_ENTRIES = 60;

declare global {
  // eslint-disable-next-line no-var
  var __leadsSearchCache: Map<string, CachedEntry> | undefined;
}

const cache: Map<string, CachedEntry> = globalThis.__leadsSearchCache ?? new Map();
globalThis.__leadsSearchCache = cache;

/**
 * Cache key inclui userId pra isolar resultados — user A nao consegue
 * usar cache de user B pra evitar consumo de quota.
 *
 * Design: "cache hit nao consome quota" continua valendo, mas SO pro
 * mesmo user que originou a busca. Outro user pedindo a mesma busca
 * vai cair em miss e consumir quota normalmente.
 */
export function cacheKey(userId: string, niche: string, location: string, limit: number) {
  return `${userId}|${normalize(niche)}|${normalize(location)}|${limit}`;
}

export function readCache(key: string): CachedEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

export function writeCache(key: string, value: Omit<CachedEntry, "expiresAt">) {
  cache.set(key, { ...value, expiresAt: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
