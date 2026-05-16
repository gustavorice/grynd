import { NextResponse } from "next/server";
import { z } from "zod";

// Vercel Pro permite até 300s; deep scrape pode demorar com muitas queries.
export const maxDuration = 300;
export const runtime = "nodejs";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { searchHistory } from "@/lib/db/schema";
import { searchGooglePlaces } from "@/lib/providers/google";
import { searchGoogleMapsScrape } from "@/lib/providers/google-maps-scrape";
import { searchOpenStreetMap } from "@/lib/providers/osm";
import { searchSerpApi } from "@/lib/providers/serpapi";
import { QuotaError, consumeSearch, getOrCreateQuota } from "@/lib/quota";
import { checkRate, searchRateLimit } from "@/lib/rate-limit";
import { cacheKey, readCache, writeCache } from "@/lib/search-cache";
import type { Lead, LeadSource, SearchResponse } from "@/lib/types";

const SearchSchema = z.object({
  niche: z.string().min(2),
  location: z.string().min(2),
  extraLocations: z.array(z.string().min(2)).max(5).optional(),
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
          message: `${cached.leads.length} leads (resultado em cache).`,
          coverageNote: "Resultado em cache de 8 min. Use 'Busca profunda' pra varredura mais ampla."
        } satisfies SearchResponse);
      }
    }

    // Checa quota ANTES de gastar recurso de scraping. Não consumimos ainda;
    // só ao final, pelo número exato de leads retornados.
    const quota = await getOrCreateQuota(user.id);
    if (quota.searchesAvailable <= 0) {
      throw new QuotaError(
        `Limite de ${quota.searchesIncluded} leads do plano ${quota.plan} atingido. Faça upgrade ou compre +200 leads.`,
        0,
        quota.plan
      );
    }

    // Lista de localizações: a principal + extras (se Pro+ pediu expansão).
    const locations = [params.location, ...(params.extraLocations ?? [])];
    const perLocationLimit = Math.ceil(params.limit / locations.length);

    // Pra cada localização, dispara 4 providers em paralelo. SerpAPI só roda
    // se SERPAPI_KEY estiver configurado (returns null senão).
    type PerLocationResult = {
      places: Lead[];
      osm: Lead[];
      scrape: Lead[];
      serp: Lead[];
      errors: string[];
    };
    const allResults: PerLocationResult[] = await Promise.all(
      locations.map(async (loc): Promise<PerLocationResult> => {
        const locParams = { ...params, location: loc, limit: perLocationLimit };
        const [places, osm, scrape, serp] = await Promise.allSettled([
          searchGooglePlaces(locParams),
          searchOpenStreetMap({ ...locParams, enrich: false }),
          params.mode === "deep" ? searchGoogleMapsScrape(locParams) : Promise.resolve([] as Lead[]),
          searchSerpApi(locParams)
        ]);
        const errors: string[] = [];
        if (places.status === "rejected") {
          const msg = places.reason instanceof Error ? places.reason.message : String(places.reason);
          errors.push(`places(${loc}): ${msg}`);
          console.error("[search] places falhou pra", loc, places.reason);
        }
        if (osm.status === "rejected") {
          const msg = osm.reason instanceof Error ? osm.reason.message : String(osm.reason);
          errors.push(`osm(${loc}): ${msg}`);
          console.error("[search] osm falhou pra", loc, osm.reason);
        }
        if (scrape.status === "rejected") {
          const msg = scrape.reason instanceof Error ? scrape.reason.message : String(scrape.reason);
          errors.push(`scrape(${loc}): ${msg}`);
          console.error("[search] scrape falhou pra", loc, scrape.reason);
        }
        if (serp.status === "rejected") {
          const msg = serp.reason instanceof Error ? serp.reason.message : String(serp.reason);
          errors.push(`serp(${loc}): ${msg}`);
          console.error("[search] serpapi falhou pra", loc, serp.reason);
        }
        return {
          places: places.status === "fulfilled" ? (places.value ?? []) : [],
          osm: osm.status === "fulfilled" ? osm.value : [],
          scrape: scrape.status === "fulfilled" ? scrape.value : [],
          serp: serp.status === "fulfilled" ? (serp.value ?? []) : [],
          errors
        };
      })
    );

    const googleLeads: Lead[] = allResults.flatMap((r) => r.places);
    const osmLeads: Lead[] = allResults.flatMap((r) => r.osm);
    const scrapedLeads: Lead[] = allResults.flatMap((r) => [...r.scrape, ...r.serp]);
    const sourceErrors = allResults.flatMap((r) => r.errors);
    let leads = mergeSources([googleLeads, scrapedLeads, osmLeads], params.limit);

    if (!leads.length) {
      throw new Error("Nao encontrei leads nesse nicho/local com as fontes disponiveis.");
    }

    // Trunca pelo que o usuário ainda tem na quota e consome esse exato volume.
    const maxAllowed = Math.min(leads.length, quota.searchesAvailable);
    leads = leads.slice(0, maxAllowed);
    await consumeSearch(user.id, leads.length);

    const sources: Record<LeadSource, number> = {
      google_places: googleLeads?.length ?? 0,
      google_maps_scrape: scrapedLeads.length,
      openstreetmap: osmLeads.length
    };

    writeCache(key, { leads, sources });
    await logHistory(user.id, params, leads.length, false, Date.now() - t0);

    const remaining = quota.searchesAvailable - leads.length;
    const baseNote =
      remaining <= 0
        ? `Quota mensal atingida com essa busca (${quota.searchesIncluded} leads). Próxima recarga na renovação do plano.`
        : `${leads.length} leads consumidos da sua quota. Restam ${remaining} este mês.`;

    // Se modo deep e scrape não trouxe nada + houve erro, sinaliza pra UI
    const scrapeIssue =
      params.mode === "deep" && scrapedLeads.length === 0 && sourceErrors.some((e) => e.startsWith("scrape"))
        ? ` (Aviso: varredura ampla indisponível neste momento — primeiro erro: ${sourceErrors.find((e) => e.startsWith("scrape"))})`
        : "";
    const coverageNote = baseNote + scrapeIssue;

    return NextResponse.json({
      leads,
      source: bestSource(sources),
      message: `${leads.length} leads encontrados.`,
      coverageNote
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
