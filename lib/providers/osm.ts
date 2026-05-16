import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import { getNicheMatchTerms, getNicheTerms, isNicheCatalogued } from "@/lib/niches";
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

/**
 * Mapeia nicho → tags OSM específicas + regex no nome. Cada entrada é uma
 * lista de fragmentos de filtro Overpass.
 *
 * Quando o nicho não está aqui, caímos no fallback inteligente: regex de
 * nome usando todos os termos do catálogo central + categorias OSM amplas.
 */
function overpassFiltersForNiche(niche: string, box: string): string {
  const normalized = normalize(niche).replace(/\s+/g, "");
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;

  const presets: Record<string, string[]> = {
    // Comida
    restaurante: [
      `nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|food_court)$"]["name"](${box});`,
      `nwr["shop"~"^(bakery|deli|confectionery)$"]["name"](${box});`
    ],
    hamburgueria: [
      `nwr["amenity"~"^(fast_food|restaurant)$"]["name"](${box});`,
      `nwr["cuisine"~"burger|american"]["name"](${box});`
    ],
    pizzaria: [
      `nwr["amenity"~"^(restaurant|fast_food)$"]["name"](${box});`,
      `nwr["cuisine"~"pizza|italian"]["name"](${box});`
    ],
    padaria: [
      `nwr["shop"="bakery"]["name"](${box});`,
      `nwr["amenity"~"^(bakery|cafe)$"]["name"](${box});`
    ],
    confeitaria: [
      `nwr["shop"~"^(confectionery|pastry|bakery)$"]["name"](${box});`,
      `nwr["amenity"="cafe"]["name"](${box});`
    ],
    lanchonete: [`nwr["amenity"~"^(fast_food|cafe|restaurant)$"]["name"](${box});`],
    cafeteria: [`nwr["amenity"="cafe"]["name"](${box});`, `nwr["shop"="coffee"]["name"](${box});`],
    bar: [`nwr["amenity"~"^(bar|pub|biergarten)$"]["name"](${box});`],
    sorveteria: [
      `nwr["amenity"="ice_cream"]["name"](${box});`,
      `nwr["shop"~"^(ice_cream|confectionery)$"]["name"](${box});`
    ],
    acai: [`nwr["amenity"~"^(ice_cream|cafe|fast_food)$"]["name"](${box});`],
    sushi: [`nwr["amenity"="restaurant"]["cuisine"~"japanese|sushi"]["name"](${box});`],
    churrascaria: [`nwr["amenity"="restaurant"]["cuisine"~"brazilian|barbecue"]["name"](${box});`],

    // Saúde
    dentista: [
      `nwr["amenity"="dentist"]["name"](${box});`,
      `nwr["healthcare"="dentist"]["name"](${box});`
    ],
    medico: [
      `nwr["amenity"~"^(doctors|clinic)$"]["name"](${box});`,
      `nwr["healthcare"~"^(doctor|clinic)$"]["name"](${box});`
    ],
    clinica: [
      `nwr["amenity"~"^(clinic|doctors)$"]["name"](${box});`,
      `nwr["healthcare"~"^(clinic|doctor)$"]["name"](${box});`
    ],
    farmacia: [
      `nwr["amenity"="pharmacy"]["name"](${box});`,
      `nwr["healthcare"="pharmacy"]["name"](${box});`
    ],
    veterinario: [`nwr["amenity"="veterinary"]["name"](${box});`],

    // Beleza
    barbearia: [
      `nwr["shop"~"^(hairdresser|beauty)$"]["name"](${box});`,
      `nwr["craft"~"^(barber)$"]["name"](${box});`
    ],
    cabeleireiro: [`nwr["shop"~"^(hairdresser|beauty)$"]["name"](${box});`],
    estetica: [`nwr["shop"~"^(beauty|cosmetics)$"]["name"](${box});`, `nwr["amenity"="spa"]["name"](${box});`],
    spa: [`nwr["amenity"="spa"]["name"](${box});`],
    manicure: [`nwr["shop"~"^(beauty|nail)$"]["name"](${box});`],
    tatuagem: [`nwr["shop"="tattoo"]["name"](${box});`, `nwr["amenity"="tattoo"]["name"](${box});`],
    otica: [`nwr["shop"~"^(optician)$"]["name"](${box});`],

    // Moda / varejo
    lojaderoupas: [`nwr["shop"~"^(clothes|fashion|boutique)$"]["name"](${box});`],
    modafeminina: [`nwr["shop"~"^(clothes|fashion|boutique)$"]["name"](${box});`],
    modamasculina: [`nwr["shop"~"^(clothes|fashion|boutique)$"]["name"](${box});`],
    modainfantil: [`nwr["shop"~"^(clothes|baby_goods)$"]["name"](${box});`],
    calcados: [`nwr["shop"="shoes"]["name"](${box});`],
    joalheria: [`nwr["shop"~"^(jewelry|jewellery)$"]["name"](${box});`],
    bijuteria: [`nwr["shop"~"^(jewelry|accessories)$"]["name"](${box});`],

    // Casa / construção
    movel: [`nwr["shop"="furniture"]["name"](${box});`],
    decoracao: [`nwr["shop"~"^(furniture|interior_decoration)$"]["name"](${box});`],
    construcao: [`nwr["shop"~"^(doityourself|hardware|trade)$"]["name"](${box});`],
    ferramenta: [`nwr["shop"="hardware"]["name"](${box});`],
    tinta: [`nwr["shop"="paint"]["name"](${box});`],

    // Pet
    petshop: [`nwr["shop"~"^(pet|pet_grooming)$"]["name"](${box});`],

    // Serviços
    advogado: [`nwr["office"="lawyer"]["name"](${box});`],
    contador: [`nwr["office"="accountant"]["name"](${box});`],
    imobiliaria: [`nwr["office"="estate_agent"]["name"](${box});`],
    arquitetura: [`nwr["office"="architect"]["name"](${box});`],

    // Educação
    escola: [`nwr["amenity"~"^(school|kindergarten)$"]["name"](${box});`],
    faculdade: [`nwr["amenity"~"^(college|university)$"]["name"](${box});`],
    cursodeingles: [`nwr["amenity"~"^(language_school|college)$"]["name"](${box});`],

    // Mercado
    mercado: [`nwr["shop"~"^(supermarket|convenience|grocery|greengrocer)$"]["name"](${box});`],
    hortifruti: [`nwr["shop"~"^(greengrocer|convenience)$"]["name"](${box});`],
    acougue: [`nwr["shop"~"^(butcher)$"]["name"](${box});`],

    // Esporte
    academia: [
      `nwr["leisure"~"^(fitness_centre|sports_centre|fitness_station)$"]["name"](${box});`,
      `nwr["amenity"~"^(gym|dancing_school|dojo)$"]["name"](${box});`,
      `nwr["sport"~"^(fitness|crossfit|yoga|pilates|bodybuilding|martial_arts|gymnastics|boxing)$"]["name"](${box});`
    ],

    // Automotivo
    oficina: [
      `nwr["shop"="car_repair"]["name"](${box});`,
      `nwr["craft"~"^(mechanic|car_repair)$"]["name"](${box});`
    ],
    borracharia: [`nwr["shop"="tyres"]["name"](${box});`],
    lavajato: [`nwr["amenity"="car_wash"]["name"](${box});`],

    // Hospitalidade
    hotel: [`nwr["tourism"~"^(hotel|motel|guest_house|hostel)$"]["name"](${box});`],
    pousada: [`nwr["tourism"~"^(guest_house|hotel|hostel)$"]["name"](${box});`],

    // Outros
    livraria: [`nwr["shop"~"^(books|stationery)$"]["name"](${box});`],
    papelaria: [`nwr["shop"="stationery"]["name"](${box});`],
    floricultura: [`nwr["shop"="florist"]["name"](${box});`],
    chaveiro: [`nwr["shop"="locksmith"]["name"](${box});`, `nwr["craft"="locksmith"]["name"](${box});`],
    fotografo: [`nwr["shop"="photo"]["name"](${box});`],

    // Tecnologia
    assistenciatecnica: [
      `nwr["shop"~"^(electronics|mobile_phone|computer)$"]["name"](${box});`,
      `nwr["craft"="electronics_repair"]["name"](${box});`
    ],
    lojadecelular: [`nwr["shop"~"^(mobile_phone|electronics)$"]["name"](${box});`],
    lojadeinformatica: [`nwr["shop"~"^(computer|electronics)$"]["name"](${box});`],

    // Indústria / B2B
    industria: [`nwr["man_made"="works"]["name"](${box});`, `nwr["landuse"="industrial"]["name"](${box});`]
  };

  // 1) Preset específico do nicho
  const preset = presets[normalized] ?? presets[singular];

  // 2) Sempre adiciona regex de nome com os termos do catálogo central +
  //    todos os termos do nicho (incluindo aliases). Cobre nomes que não
  //    estão tagged certo no OSM (acontece muito no Brasil).
  const nameTerms = getNicheMatchTerms(niche).filter((t) => t.length >= 4);

  const filters: string[] = [];
  if (preset) filters.push(...preset);
  if (nameTerms.length > 0) filters.push(nameRegexFilter(box, nameTerms));

  // 3) Se não tem preset E o nicho não está catalogado, escaneia categorias
  //    amplas (qualquer shop/amenity/office). matchesNiche filtra depois.
  if (!preset && !isNicheCatalogued(niche)) {
    filters.push(...CATEGORY_KEYS.map((key) => `nwr["${key}"]["name"](${box});`));
  }

  return filters.join("\n");
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
      tags.cuisine,
      tags.description
    ]
      .filter(Boolean)
      .join(" ")
  );

  // Se nicho NÃO está catalogado, confia no filtro Overpass (que já fez
  // regex de nome). Aceita o lead.
  if (!isNicheCatalogued(niche)) return true;

  const terms = getNicheMatchTerms(niche).map(normalize).filter(Boolean);
  return terms.some((term) => containsTerm(haystack, term));
}

function nicheTerms(niche: string) {
  return getNicheTerms(niche);
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
