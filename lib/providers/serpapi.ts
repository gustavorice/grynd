import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import { getNicheTerms } from "@/lib/niches";
import type { Lead } from "@/lib/types";

/**
 * Provider Google Maps via SerpAPI — alternativa robusta ao Playwright,
 * funciona perfeitamente em serverless (Vercel, AWS Lambda), retorna JSON.
 *
 * Free tier: 100 buscas/mês. Pro $50: 5.000.
 *
 * Ativa automaticamente quando SERPAPI_KEY está setado no env.
 * Quando NÃO está, retorna null (provider pula sem erro).
 */

type SerpApiPlace = {
  position: number;
  title: string;
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  reviews_link?: string;
  photos_link?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  place_id_search?: string;
  provider_id?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  type?: string;
  types?: string[];
  address?: string;
  open_state?: string;
  hours?: string;
  operating_hours?: Record<string, string>;
  phone?: string;
  website?: string;
  description?: string;
  service_options?: Record<string, boolean>;
  thumbnail?: string;
};

type SerpApiResponse = {
  local_results?: SerpApiPlace[];
  search_information?: { local_results_state?: string };
  error?: string;
};

const SERPAPI_CONCURRENCY = 4;
const SERPAPI_QUERIES_PER_NICHE = 4; // # de variações por query

export async function searchSerpApi(params: {
  niche: string;
  location: string;
  limit: number;
  enrich: boolean;
}): Promise<Lead[] | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const terms = getNicheTerms(params.niche).slice(0, SERPAPI_QUERIES_PER_NICHE);
  const queries = terms.map((t) => `${t} ${params.location}`);

  const placesByKey = new Map<string, SerpApiPlace>();

  // Em paralelo, dispara até SERPAPI_CONCURRENCY queries
  const batches = chunk(queries, SERPAPI_CONCURRENCY);
  for (const batch of batches) {
    if (placesByKey.size >= params.limit) break;
    const settled = await Promise.allSettled(
      batch.map((q) => fetchSerpApi(q, apiKey))
    );
    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      for (const place of r.value) {
        const key = place.place_id ?? place.data_id ?? place.title.toLowerCase();
        if (!placesByKey.has(key)) placesByKey.set(key, place);
        if (placesByKey.size >= params.limit) break;
      }
    }
  }

  const places = Array.from(placesByKey.values()).slice(0, params.limit);

  const leads = await Promise.all(
    places.map(async (place) => {
      const website = place.website;
      const enrichment = params.enrich ? await enrichFromWebsite(website) : {};
      const phone = place.phone ?? enrichment.phone;
      const name = place.title;
      const category = place.type ?? place.types?.[0] ?? params.niche;
      const address = place.address ?? params.location;
      const lat = place.gps_coordinates?.latitude;
      const lng = place.gps_coordinates?.longitude;

      const diagnosis = diagnoseLead({
        name,
        category,
        phone,
        whatsapp: enrichment.whatsapp,
        website,
        instagram: enrichment.instagram,
        email: enrichment.email,
        rating: place.rating,
        reviewCount: place.reviews,
        address
      });

      return {
        id: `serp-${place.place_id ?? place.data_id ?? Buffer.from(name).toString("base64").slice(0, 16)}`,
        source: "google_maps_scrape", // mantém compatibilidade com o tipo existente
        sourceId: place.place_id ?? place.data_id ?? name,
        name,
        category,
        niche: params.niche,
        address,
        city: params.location,
        phone,
        whatsapp: enrichment.whatsapp,
        website,
        instagram: enrichment.instagram,
        facebook: enrichment.facebook,
        email: enrichment.email,
        mapsUrl: place.data_cid
          ? `https://www.google.com/maps?cid=${place.data_cid}`
          : lat && lng
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : undefined,
        rating: place.rating,
        reviewCount: place.reviews,
        latitude: lat,
        longitude: lng,
        status: "new",
        tags: [params.niche, params.location],
        raw: place as unknown as Record<string, unknown>,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...diagnosis
      } satisfies Lead;
    })
  );

  return leads;
}

async function fetchSerpApi(query: string, apiKey: string): Promise<SerpApiPlace[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "pt-br");
  url.searchParams.set("gl", "br");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    console.error("[serpapi] erro HTTP", response.status, await response.text().catch(() => ""));
    return [];
  }
  const data = (await response.json()) as SerpApiResponse;
  if (data.error) {
    console.error("[serpapi] erro de API", data.error);
    return [];
  }
  return data.local_results ?? [];
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
