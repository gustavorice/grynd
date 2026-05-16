import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import type { Lead } from "@/lib/types";

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
};

type GoogleResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.types",
  "nextPageToken"
].join(",");

export async function searchGooglePlaces(params: {
  niche: string;
  location: string;
  limit: number;
  enrich: boolean;
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const byId = new Map<string, GooglePlace>();
  const queries = buildGoogleQueries(params.niche, params.location);

  for (const textQuery of queries) {
    if (byId.size >= params.limit) break;
    const places = await runTextSearch({
      apiKey,
      textQuery,
      limit: Math.max(10, params.limit - byId.size)
    });
    for (const place of places) {
      byId.set(place.id, place);
      if (byId.size >= params.limit) break;
    }
  }

  const all = Array.from(byId.values()).slice(0, params.limit);
  const leads = await enrichInBatches(all, async (place) => {
    const enrichment = params.enrich ? await enrichFromWebsite(place.websiteUri) : {};
    const phone =
      place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? enrichment.phone;
    const name = place.displayName?.text ?? "Negocio sem nome";
    const category = place.primaryTypeDisplayName?.text ?? place.types?.[0] ?? params.niche;
    const address = place.formattedAddress ?? "";
    const diagnosis = diagnoseLead({
      name,
      category,
      address,
      phone,
      whatsapp: enrichment.whatsapp,
      website: place.websiteUri,
      instagram: enrichment.instagram,
      email: enrichment.email,
      rating: place.rating,
      reviewCount: place.userRatingCount
    });

    return {
      id: `google-${place.id}`,
      source: "google_places",
      sourceId: place.id,
      name,
      category,
      niche: params.niche,
      address,
      city: params.location,
      phone,
      whatsapp: enrichment.whatsapp,
      website: place.websiteUri,
      instagram: enrichment.instagram,
      facebook: enrichment.facebook,
      email: enrichment.email,
      mapsUrl: place.googleMapsUri,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      status: "new",
      tags: [params.niche, params.location],
      raw: place as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...diagnosis
    } satisfies Lead;
  });

  return leads;
}

const ENRICH_CONCURRENCY = 6;

async function enrichInBatches<T, R>(items: T[], handler: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += ENRICH_CONCURRENCY) {
    const slice = items.slice(i, i + ENRICH_CONCURRENCY);
    const settled = await Promise.allSettled(slice.map((item) => handler(item)));
    for (const result of settled) {
      if (result.status === "fulfilled") results.push(result.value);
    }
  }
  return results;
}

async function runTextSearch(params: { apiKey: string; textQuery: string; limit: number }) {
  const all: GooglePlace[] = [];
  let pageToken: string | undefined;

  while (all.length < params.limit) {
    const body: Record<string, unknown> = {
      textQuery: params.textQuery,
      languageCode: "pt-BR",
      pageSize: Math.min(20, params.limit - all.length)
    };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": params.apiKey,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Google Places retornou ${response.status}`);
    }

    const data = (await response.json()) as GoogleResponse;
    all.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return all;
}

function buildGoogleQueries(niche: string, location: string) {
  const normalized = normalize(niche);
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  const aliases: Record<string, string[]> = {
    sorveteria: ["sorvetes", "gelateria", "gelato", "acai", "açaí", "ice cream"],
    academia: ["academia", "fitness", "crossfit", "pilates", "yoga", "musculacao", "musculação", "personal trainer"],
    restaurante: ["restaurante", "lanchonete", "pizzaria", "hamburgueria", "cafe", "bar"],
    dentista: ["dentista", "odontologia", "clinica odontologica"],
    advogado: ["advogado", "advocacia", "escritorio de advocacia"],
    farmacia: ["farmacia", "farmácia", "drogaria"],
    mercado: ["mercado", "supermercado", "mercearia"],
    clinica: ["clinica", "clínica", "consultorio medico", "médico"],
    oficina: ["oficina mecanica", "auto center", "mecanica automotiva"]
  };
  const terms = [niche, singular, ...(aliases[normalized] ?? []), ...(aliases[singular] ?? [])];
  return Array.from(new Set(terms.map((term) => `${term} em ${location}`)));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
