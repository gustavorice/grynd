import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { searchHistory } from "@/lib/db/schema";
import { searchGooglePlaces } from "@/lib/providers/google";
import { searchGoogleMapsScrape } from "@/lib/providers/google-maps-scrape";
import { searchOpenStreetMap } from "@/lib/providers/osm";
import { QuotaError, consumeSearch } from "@/lib/quota";
import { checkRate, searchRateLimit } from "@/lib/rate-limit";
import { cacheKey, readCache, writeCache } from "@/lib/search-cache";
import type { Lead, LeadSource, SearchResponse } from "@/lib/types";

const SearchSchema = z.object({
  niche: z.string().min(2),
  location: z.string().min(2),
  limit: z.coerce.number().min(1).max(180).default(120),
  enrich: z.boolean().default(true),
  refresh: z.boolean().default(false),
  mode: z.enum(["fast", "deep"]).default("fast")
});

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const user = await getOrSyncUser();

    // Rate limit por user (burst control).
    const rate = await checkRate(searchRateLimit(), `user:${user.id}`);
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: "Muitas buscas em sequencia. Aguarde alguns segundos.",
          resetAt: rate.reset
        },
        { status: 429 }
      );
    }

    const params = SearchSchema.parse(await request.json());
    const key = cacheKey(params.niche, params.location, params.limit);

    if (!params.refresh) {
      const cached = readCache(key);
      if (cached) {
        // Cache não consome quota.
        await logHistory(user.id, params, cached.leads.length, true, Date.now() - t0);
        return NextResponse.json({
          leads: cached.leads,
          source: bestSource(cached.sources),
          message: buildSourceMessage(cached.sources, true),
          coverageNote:
            "Resultado em cache (8 min). Use 'Busca profunda' pra forçar varredura nova mais ampla."
        } satisfies SearchResponse);
      }
    }

    // Consome quota antes de gastar recurso de scraping.
    await consumeSearch(user.id, 1);

    const [placesResult, osmResult, scrapeResult] = await Promise.allSettled([
      searchGooglePlaces(params),
      searchOpenStreetMap({ ...params, enrich: false }),
      params.mode === "deep" ? searchGoogleMapsScrape(params) : Promise.resolve([] as Lead[])
    ]);

    const googleLeads = placesResult.status === "fulfilled" ? placesResult.value : null;
    const osmLeads = osmResult.status === "fulfilled" ? osmResult.value : [];
    const scrapedLeads = scrapeResult.status === "fulfilled" ? scrapeResult.value : [];
    const leads = mergeSources([googleLeads ?? [], scrapedLeads, osmLeads], params.limit);

    if (!leads.length) {
      throw new Error("Nao encontrei leads nesse nicho/local com as fontes disponiveis.");
    }

    const sources: Record<LeadSource, number> = {
      google_places: googleLeads?.length ?? 0,
      google_maps_scrape: scrapedLeads.length,
      openstreetmap: osmLeads.length
    };

    writeCache(key, { leads, sources });
    await logHistory(user.id, params, leads.length, false, Date.now() - t0);

    return NextResponse.json({
      leads,
      source: bestSource(sources),
      message: buildSourceMessage(sources, false),
      coverageNote:
        "Motor rapido: fontes em paralelo, termos equivalentes por nicho e deduplicacao. Resultado cacheado por 8 min."
    } satisfies SearchResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof QuotaError) {
      return NextResponse.json({ error: error.message, plan: error.plan }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao buscar leads." },
      { status: 400 }
    );
  }
}

async function logHistory(
  userId: string,
  params: z.infer<typeof SearchSchema>,
  resultCount: number,
  fromCache: boolean,
  durationMs: number
) {
  try {
    await db.insert(searchHistory).values({
      userId,
      niche: params.niche,
      location: params.location,
      mode: params.mode,
      resultCount,
      fromCache,
      durationMs
    });
  } catch (error) {
    // Logging best-effort — não bloqueia resposta.
    console.warn("[search] falha ao gravar history", error);
  }
}

function bestSource(sources: Record<LeadSource, number>): LeadSource {
  if (sources.google_places) return "google_places";
  if (sources.google_maps_scrape) return "google_maps_scrape";
  return "openstreetmap";
}

function buildSourceMessage(sources: Record<LeadSource, number>, cached: boolean) {
  const parts = [
    sources.google_places ? `Google Places (${sources.google_places})` : undefined,
    sources.google_maps_scrape ? `Google Maps scraping (${sources.google_maps_scrape})` : undefined,
    sources.openstreetmap ? `OpenStreetMap (${sources.openstreetmap})` : undefined
  ].filter(Boolean);
  const prefix = cached ? "Cache:" : "Busca combinada:";
  return `${prefix} ${parts.join(" + ")}.`;
}

function mergeSources(sourceLists: Lead[][], limit: number) {
  const byKey = new Map<string, Lead>();
  for (const list of sourceLists) {
    for (const lead of list) {
      const key = leadKey(lead);
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeLead(existing, lead) : lead);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => sourceRank(b.source) - sourceRank(a.source) || b.score - a.score)
    .slice(0, limit);
}

function mergeLead(a: Lead, b: Lead) {
  const preferred = sourceRank(b.source) >= sourceRank(a.source) ? b : a;
  const secondary = preferred === b ? a : b;
  return {
    ...secondary,
    ...preferred,
    phone: preferred.phone ?? secondary.phone,
    whatsapp: preferred.whatsapp ?? secondary.whatsapp,
    website: preferred.website ?? secondary.website,
    instagram: preferred.instagram ?? secondary.instagram,
    facebook: preferred.facebook ?? secondary.facebook,
    email: preferred.email ?? secondary.email,
    address: preferred.address || secondary.address,
    rating: preferred.rating ?? secondary.rating,
    reviewCount: preferred.reviewCount ?? secondary.reviewCount,
    latitude: preferred.latitude ?? secondary.latitude,
    longitude: preferred.longitude ?? secondary.longitude,
    mapsUrl: preferred.mapsUrl ?? secondary.mapsUrl,
    score: Math.max(preferred.score, secondary.score),
    tags: Array.from(new Set([...secondary.tags, ...preferred.tags]))
  };
}

function sourceRank(source: Lead["source"]) {
  if (source === "google_places") return 3;
  if (source === "google_maps_scrape") return 2;
  return 1;
}

function leadKey(lead: Lead) {
  const name = normalize(lead.name);
  if (lead.latitude && lead.longitude) {
    return `${name}:${lead.latitude.toFixed(3)}:${lead.longitude.toFixed(3)}`;
  }
  return name;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
