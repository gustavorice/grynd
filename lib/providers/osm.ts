import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import type { Lead } from "@/lib/types";

type NominatimResult = {
  boundingbox?: [string, string, string, string];
  display_name?: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const CATEGORY_KEYS = ["amenity", "shop", "office", "craft", "tourism", "leisure", "healthcare", "sport"];
const FALLBACK_LIMIT = 220;

const NICHE_ALIASES: Record<string, string[]> = {
  academia: [
    "academia",
    "fitness",
    "gym",
    "crossfit",
    "pilates",
    "yoga",
    "funcional",
    "personal",
    "treinamento",
    "musculacao",
    "musculação",
    "boxe",
    "muay thai",
    "dojo",
    "dancing_school",
    "fitness_centre",
    "sports_centre"
  ],
  sorveteria: ["sorveteria", "sorvete", "ice_cream", "ice cream", "gelato", "acai", "açaí", "milk shake"],
  restaurante: ["restaurant", "restaurante", "fast_food", "lanchonete", "pizzaria", "pizza", "hamburguer", "burger", "cafe", "bar", "pub"],
  dentista: ["dentist", "dentista", "odontologia", "odontologico", "odontológico"],
  advogado: ["lawyer", "advogado", "advocacia", "juridico", "jurídico"],
  farmacia: ["pharmacy", "farmacia", "farmácia", "drogaria"],
  mercado: ["supermarket", "mercado", "supermercado", "convenience", "grocery", "mercearia"],
  clinica: ["clinic", "clinica", "clínica", "doctors", "healthcare", "medico", "médico"],
  oficina: ["car_repair", "oficina", "mecanica", "mecânica", "mechanic", "auto center"]
};

export async function searchOpenStreetMap(params: {
  niche: string;
  location: string;
  limit: number;
  enrich: boolean;
}) {
  const bbox = await geocodeLocation(params.location);
  const query = buildOverpassQuery(bbox, params.niche, params.limit);
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "LeadHubLocal/0.1 (+local research tool)"
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap retornou ${response.status}`);
  }

  const data = (await response.json()) as { elements?: OverpassElement[] };
  const filtered = dedupeElements(data.elements ?? [])
    .filter((item) => item.tags?.name)
    .filter((item) => matchesNiche(item.tags ?? {}, params.niche))
    .slice(0, params.limit);

  const leads = await runWithConcurrency(filtered, ENRICH_CONCURRENCY, async (item) => {
    const tags = item.tags ?? {};
    const website = tags.website ?? tags["contact:website"];
    const enrichment = params.enrich ? await enrichFromWebsite(website) : {};
    const phone = tags.phone ?? tags["contact:phone"] ?? enrichment.phone;
    const whatsapp = tags["contact:whatsapp"] ?? tags.whatsapp ?? enrichment.whatsapp;
    const name = tags.name;
    const category = inferCategory(tags);
    const address = formatOsmAddress(tags);
    const instagram = tags["contact:instagram"] ?? enrichment.instagram;
    const facebook = tags["contact:facebook"] ?? enrichment.facebook;
    const email = tags.email ?? tags["contact:email"] ?? enrichment.email;
    const diagnosis = diagnoseLead({
      name,
      category,
      phone,
      whatsapp,
      website,
      instagram,
      email,
      address
    });
    const lat = item.lat ?? item.center?.lat;
    const lon = item.lon ?? item.center?.lon;

    return {
      id: `osm-${item.type}-${item.id}`,
      source: "openstreetmap",
      sourceId: `${item.type}-${item.id}`,
      name,
      category,
      niche: params.niche,
      address,
      city: params.location,
      phone,
      whatsapp,
      website,
      instagram,
      facebook,
      email,
      mapsUrl:
        lat && lon
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${params.location}`)}`,
      latitude: lat,
      longitude: lon,
      status: "new",
      score: diagnosis.score,
      companySize: diagnosis.companySize,
      diagnosis: diagnosis.diagnosis,
      nextAction: diagnosis.nextAction,
      tags: [params.niche, params.location],
      raw: tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies Lead;
  });

  return leads;
}

const ENRICH_CONCURRENCY = 6;

async function runWithConcurrency<T, R>(items: T[], concurrency: number, handler: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(slice.map((item) => handler(item)));
    for (const result of settled) {
      if (result.status === "fulfilled") results.push(result.value);
    }
  }
  return results;
}

async function geocodeLocation(location: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", location);

  const response = await fetch(url, {
    headers: { "user-agent": "LeadHubLocal/0.1 (+local research tool)" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Nao consegui localizar essa cidade/regiao.");

  const results = (await response.json()) as NominatimResult[];
  const bbox = results[0]?.boundingbox;
  if (!bbox) throw new Error("Localizacao sem caixa geografica.");

  const [south, north, west, east] = bbox.map(Number);
  return { south, north, west, east };
}

function buildOverpassQuery(
  bbox: { south: number; north: number; west: number; east: number },
  niche: string,
  limit: number
) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const filters = overpassFiltersForNiche(niche, box);
  const outputLimit = Math.min(Math.max(limit * 8, 80), FALLBACK_LIMIT);
  return `
    [out:json][timeout:25];
    (
      ${filters}
    );
    out center ${outputLimit};
  `;
}

function overpassFiltersForNiche(niche: string, box: string) {
  const normalized = normalize(niche);
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;

  const presets: Record<string, string[]> = {
    restaurante: [
      `nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream)$"]["name"](${box});`,
      `nwr["shop"~"^(bakery|deli)$"]["name"](${box});`,
      nameRegexFilter(box, ["restaurante", "lanchonete", "pizzaria", "hamburguer", "burger", "pizza", "cafe"])
    ],
    sorveteria: [
      `nwr["amenity"="ice_cream"]["name"](${box});`,
      `nwr["shop"~"^(ice_cream|confectionery|pastry)$"]["name"](${box});`,
      nameRegexFilter(box, ["sorveteria", "sorvete", "gelato", "acai", "açaí", "milk shake"])
    ],
    dentista: [
      `nwr["amenity"="dentist"]["name"](${box});`,
      `nwr["healthcare"="dentist"]["name"](${box});`,
      nameRegexFilter(box, ["dentista", "odontologia", "odontologico", "odontológico"])
    ],
    academia: [
      `nwr["leisure"="fitness_centre"]["name"](${box});`,
      `nwr["leisure"="sports_centre"]["name"](${box});`,
      `nwr["leisure"="fitness_station"]["name"](${box});`,
      `nwr["amenity"="gym"]["name"](${box});`,
      `nwr["sport"~"^(fitness|crossfit|yoga|pilates|bodybuilding|martial_arts|gymnastics|boxing)$"]["name"](${box});`,
      `nwr["amenity"~"^(dancing_school|dojo)$"]["name"](${box});`,
      nameRegexFilter(box, [
        "academia",
        "fitness",
        "gym",
        "crossfit",
        "pilates",
        "yoga",
        "funcional",
        "personal",
        "treinamento",
        "musculacao",
        "musculação",
        "boxe",
        "muay thai",
        "dojo"
      ])
    ],
    advogado: [`nwr["office"="lawyer"]["name"](${box});`, nameRegexFilter(box, ["advogado", "advocacia", "juridico", "jurídico"])],
    farmacia: [
      `nwr["amenity"="pharmacy"]["name"](${box});`,
      `nwr["healthcare"="pharmacy"]["name"](${box});`,
      nameRegexFilter(box, ["farmacia", "farmácia", "drogaria"])
    ],
    mercado: [`nwr["shop"~"^(supermarket|convenience|grocery)$"]["name"](${box});`, nameRegexFilter(box, ["mercado", "supermercado", "mercearia"])],
    clinica: [
      `nwr["amenity"~"^(clinic|doctors)$"]["name"](${box});`,
      `nwr["healthcare"~"^(clinic|doctor)$"]["name"](${box});`,
      nameRegexFilter(box, ["clinica", "clínica", "medico", "médico"])
    ],
    oficina: [
      `nwr["shop"="car_repair"]["name"](${box});`,
      `nwr["craft"~"^(mechanic|car_repair)$"]["name"](${box});`,
      nameRegexFilter(box, ["oficina", "mecanica", "mecânica", "auto center"])
    ]
  };

  const preset = presets[normalized] ?? presets[singular];
  if (preset) return preset.join("\n");
  return [nameRegexFilter(box, nicheTerms(normalized)), ...CATEGORY_KEYS.map((key) => `nwr["${key}"]["name"](${box});`)].join("\n");
}

function matchesNiche(tags: Record<string, string>, niche: string) {
  const needle = normalize(niche);
  if (!needle || ["todos", "all", "negocios", "empresas"].includes(needle)) return true;
  const singular = needle.endsWith("s") ? needle.slice(0, -1) : needle;

  if (singular === "academia" && ["park", "playground", "pitch"].includes(tags.leisure ?? "")) {
    return false;
  }

  const haystack = normalize(
    [
      tags.name,
      tags.amenity,
      tags.shop,
      tags.office,
      tags.craft,
      tags.tourism,
      tags.leisure,
      tags.healthcare,
      tags.description
    ]
      .filter(Boolean)
      .join(" ")
  );

  const terms = nicheTerms(needle);
  return terms.some((term) => containsTerm(haystack, term));
}

function nicheTerms(niche: string) {
  const singular = niche.endsWith("s") ? niche.slice(0, -1) : niche;
  return [niche, singular, ...(NICHE_ALIASES[niche] ?? []), ...(NICHE_ALIASES[singular] ?? [])];
}

function nameRegexFilter(box: string, terms: string[]) {
  const safeTerms = Array.from(new Set(terms.map(normalize).filter((term) => term.length >= 3))).map(escapeRegex);
  return `nwr["name"~"(${safeTerms.join("|")})",i](${box});`;
}

function containsTerm(haystack: string, term: string) {
  const normalized = normalize(term);
  if (normalized.length <= 3) {
    return haystack.split(/[^a-z0-9_]+/).includes(normalized);
  }
  return haystack.includes(normalized);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeElements(elements: OverpassElement[]) {
  const seen = new Set<string>();
  return elements.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCategory(tags: Record<string, string>) {
  for (const key of CATEGORY_KEYS) {
    if (tags[key]) return `${key}:${tags[key]}`;
  }
  return "negocio local";
}

function formatOsmAddress(tags: Record<string, string>) {
  return [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"]
  ]
    .filter(Boolean)
    .join(", ");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
