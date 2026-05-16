import { existsSync } from "node:fs";
import { diagnoseLead } from "@/lib/diagnose";
import { extractBrazilPhone, normalizeBrazilPhone } from "@/lib/phone";
import type { Lead } from "@/lib/types";

type ScrapedPlace = {
  name: string;
  href: string;
  cardText: string;
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
};

type ScrapedContact = Pick<ScrapedPlace, "phone" | "website" | "instagram" | "facebook">;

const BROWSER_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
];
const SCRAPE_CONCURRENCY = 4;
const SCROLL_STEPS = 3;
const CONTACT_HYDRATION_LIMIT = 10;
const CONTACT_CONCURRENCY = 8;

export async function searchGoogleMapsScrape(params: {
  niche: string;
  location: string;
  limit: number;
}) {
  const executablePath = BROWSER_PATHS.find((item) => existsSync(item));
  if (!executablePath) {
    throw new Error("Chrome ou Edge nao encontrado para scraping temporario.");
  }

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  try {
    const page = await browser.newPage({
      locale: "pt-BR",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    });

    await page.close();
    const placesByName = new Map<string, ScrapedPlace>();
    const queries = buildScrapeQueries(params.niche, params.location).slice(0, queryLimit(params.limit));
    const batches = chunk(queries, SCRAPE_CONCURRENCY);

    for (const batch of batches) {
      if (placesByName.size >= params.limit) break;
      const settled = await Promise.allSettled(batch.map((query) => scrapeQuery(browser, query, params)));
      for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        for (const place of result.value) {
          placesByName.set(normalize(place.name), place);
          if (placesByName.size >= params.limit) break;
        }
      }
    }

    const places = Array.from(placesByName.values());
    const hydratedPlaces = await hydratePlacesWithContacts(browser, places, Math.min(CONTACT_HYDRATION_LIMIT, params.limit));
    return hydratedPlaces.map((place) => toLead(place, params));
  } finally {
    await browser.close();
  }
}

export async function scrapeGoogleMapsContact(url: string): Promise<ScrapedContact> {
  const executablePath = BROWSER_PATHS.find((item) => existsSync(item));
  if (!executablePath) return {};

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  try {
    return await scrapeContactWithBrowser(browser, url);
  } finally {
    await browser.close().catch(() => null);
  }
}

async function hydratePlacesWithContacts(browser: any, places: ScrapedPlace[], limit: number) {
  if (!places.length || limit <= 0) return places;
  const targets = places.slice(0, limit);
  const hydrated = new Map<string, ScrapedPlace>();

  for (const batch of chunk(targets, CONTACT_CONCURRENCY)) {
    const settled = await Promise.allSettled(
      batch.map(async (place) => {
        const contact = await scrapeContactWithBrowser(browser, place.href);
        return {
          ...place,
          phone: contact.phone ?? place.phone,
          website: contact.website ?? place.website,
          instagram: contact.instagram ?? place.instagram,
          facebook: contact.facebook ?? place.facebook
        };
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") hydrated.set(result.value.href, result.value);
    }
  }

  return places.map((place) => hydrated.get(place.href) ?? place);
}

async function scrapeContactWithBrowser(browser: any, url: string): Promise<ScrapedContact> {
  const page = await browser.newPage({
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  });

  try {
    await blockHeavyAssets(page);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page
      .locator('button[data-item-id*="phone"], a[data-item-id*="authority"], a[href^="tel:"]')
      .first()
      .waitFor({ state: "attached", timeout: 1400 })
      .catch(() => null);
    await page.waitForTimeout(350);

    const text = await page.locator("body").innerText({ timeout: 2500 }).catch(() => "");
    const hrefs = await page
      .locator("a")
      .evaluateAll((anchors: HTMLAnchorElement[]) => anchors.map((anchor) => anchor.href).filter(Boolean))
      .catch(() => [] as string[]);
    const socials = extractSocialLinks(hrefs);
    const phone = extractBrazilPhone(text) ?? extractPhoneFromHrefs(hrefs);
    const website = extractWebsiteFromHrefs(hrefs);

    return { phone, website, ...socials };
  } finally {
    await page.close().catch(() => null);
  }
}

async function scrapeQuery(
  browser: { newPage: (options: Record<string, unknown>) => Promise<any> },
  query: string,
  params: { niche: string; limit: number }
) {
  const page = await browser.newPage({
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  });

  try {
    await blockHeavyAssets(page);

    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 22000
    });
    await page.locator('a[href*="/maps/place"]').first().waitFor({ state: "attached", timeout: 7000 }).catch(() => null);

    let lastCount = 0;
    let stagnant = 0;
    for (let i = 0; i < SCROLL_STEPS; i += 1) {
      const count = await countPlaceLinks(page);
      if (count >= params.limit) break;
      if (count === lastCount) stagnant += 1;
      if (stagnant >= 2 && count > 0) break;
      lastCount = count;
      await page.locator('div[role="feed"]').hover({ timeout: 1200 }).catch(() => null);
      await page.mouse.wheel(0, 3200);
      await page.waitForTimeout(650);
    }

    const places = await extractPlaces(page, params.limit);
    return places.filter((place) => matchesScrapedNiche(place, params.niche));
  } finally {
    await page.close().catch(() => null);
  }
}

async function extractPlaces(page: { evaluate: <T>(fn: (limit: number) => T, limit: number) => Promise<T> }, limit: number) {
  return page.evaluate((take) => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place"]'));
    const seen = new Set<string>();

    function cardText(anchor: HTMLAnchorElement) {
      const article = anchor.closest<HTMLElement>('[role="article"]');
      if (article?.innerText?.trim()) return article.innerText.trim();

      let el: HTMLElement | null = anchor;
      for (let i = 0; i < 8 && el; i += 1) {
        const text = el.innerText?.trim();
        if (text && text.length > 20) return text;
        el = el.parentElement;
      }
      return anchor.getAttribute("aria-label") ?? "";
    }

    const results: ScrapedPlace[] = [];
    for (const anchor of anchors) {
      const name = anchor.getAttribute("aria-label")?.trim();
      if (!name || seen.has(anchor.href)) continue;
      seen.add(anchor.href);
      results.push({ name, href: anchor.href, cardText: cardText(anchor) });
      if (results.length >= take) break;
    }
    return results;
  }, limit);
}

async function countPlaceLinks(page: { locator: (selector: string) => { count: () => Promise<number> } }) {
  try {
    return await page.locator('a[href*="/maps/place"]').count();
  } catch {
    return 0;
  }
}

async function blockHeavyAssets(page: any) {
  await page.route("**/*", (route: any) => {
    const resourceType = route.request().resourceType();
    if (["image", "media", "font"].includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });
}

function buildScrapeQueries(niche: string, location: string) {
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
  return Array.from(new Set(terms.map((term) => `${term} ${location}`)));
}

function queryLimit(limit: number) {
  if (limit >= 80) return 10;
  if (limit >= 40) return 8;
  if (limit >= 20) return 6;
  return 4;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function matchesScrapedNiche(place: ScrapedPlace, niche: string) {
  const parsed = parseGoogleCardText(place.cardText, place.name);
  const text = normalize(`${place.name} ${parsed.category ?? ""}`);
  const base = normalize(niche);
  const singular = base.endsWith("s") ? base.slice(0, -1) : base;
  const termsByNiche: Record<string, string[]> = {
    sorveteria: ["sorveteria", "sorvete", "gelateria", "gelato", "ice cream", "acai", "açai", "açaí", "milk moo", "ice creamy"],
    academia: ["academia", "fitness", "gym", "crossfit", "pilates", "yoga", "musculacao", "musculação", "boxe", "muay thai", "dojo", "treinamento"],
    restaurante: ["restaurante", "restaurant", "lanchonete", "pizzaria", "hamburgueria", "burger", "cafe", "bar", "fast food"],
    dentista: ["dentista", "dentist", "odontologia", "odontologico", "odontológico"],
    advogado: ["advogado", "advocacia", "lawyer", "juridico", "jurídico"],
    farmacia: ["farmacia", "farmácia", "drogaria", "pharmacy"],
    mercado: ["mercado", "supermercado", "mercearia", "supermarket"],
    clinica: ["clinica", "clínica", "clinic", "medico", "médico"],
    oficina: ["oficina", "mecanica", "mecânica", "auto center", "mechanic"]
  };
  const excludedByNiche: Record<string, string[]> = {
    sorveteria: ["atacadista", "supermercado", "mercado atacado"],
    academia: ["lanchonete", "restaurante", "fast food", "sorveteria"]
  };
  const terms = [base, singular, ...(termsByNiche[base] ?? []), ...(termsByNiche[singular] ?? [])].map(normalize);
  const excluded = [...(excludedByNiche[base] ?? []), ...(excludedByNiche[singular] ?? [])].map(normalize);
  return terms.some((term) => text.includes(term)) && !excluded.some((term) => text.includes(term));
}

function toLead(place: ScrapedPlace, params: { niche: string; location: string }) {
  const parsed = parseGoogleCardText(place.cardText, place.name);
  const coords = parseCoordinates(place.href);
  const diagnosis = diagnoseLead({
    name: place.name,
    category: parsed.category,
    address: parsed.address,
    phone: place.phone,
    website: place.website,
    instagram: place.instagram,
    rating: parsed.rating,
    reviewCount: parsed.reviewCount
  });

  return {
    id: `gmap-${stableId(place.href)}`,
    source: "google_maps_scrape",
    sourceId: stableId(place.href),
    name: place.name,
    category: parsed.category ?? params.niche,
    niche: params.niche,
    address: parsed.address ?? params.location,
    city: params.location,
    mapsUrl: place.href,
    phone: place.phone,
    website: place.website,
    instagram: place.instagram,
    facebook: place.facebook,
    rating: parsed.rating,
    reviewCount: parsed.reviewCount,
    latitude: coords?.lat,
    longitude: coords?.lng,
    status: "new",
    tags: [params.niche, params.location],
    raw: { cardText: place.cardText },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...diagnosis
  } satisfies Lead;
}


function parseGoogleCardText(text: string, name: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== name);
  const joined = lines.join(" ");
  const rating = Number((joined.match(/\b([1-5],[0-9])\b/)?.[1] ?? "").replace(",", ".")) || undefined;
  const reviewCountText = joined.match(/\(([\d.,]+\s?[KkMm]?)\)/)?.[1];
  const reviewCount = parseReviewCount(reviewCountText);
  const separator = /\u00b7|Â·|Ã‚Â·/;
  const categoryLine = lines.find((line) => separator.test(line));
  const parts = categoryLine?.split(separator).map((part) => part.trim()).filter(Boolean) ?? [];
  const categoryIndex = parts.findIndex((part) => !looksLikeRatingPart(part) && !looksLikeOpenStatus(part));
  const category = categoryIndex >= 0 ? parts[categoryIndex] : undefined;
  const address = categoryIndex >= 0 ? parts.slice(categoryIndex + 1).join(" - ").trim() : undefined;
  return { rating, reviewCount, category, address };
}

function looksLikeRatingPart(value: string) {
  return /^[1-5],[0-9]\s*(?:\([\d.,]+\s?[KkMm]?\))?$/.test(value.trim());
}

function looksLikeOpenStatus(value: string) {
  return /^(aberto|fechado|fecha|abre)\b/i.test(value.trim());
}

function extractWebsiteFromHrefs(hrefs: string[]) {
  for (const href of hrefs) {
    const unwrapped = unwrapExternalUrl(href);
    if (!unwrapped || !/^https?:\/\//i.test(unwrapped)) continue;

    try {
      const url = new URL(unwrapped);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (isGoogleHost(host) || isSocialHost(host)) continue;
      if (["gstatic.com", "googleapis.com", "ggpht.com"].some((blocked) => host.endsWith(blocked))) continue;
      url.hash = "";
      return url.toString();
    } catch {
      continue;
    }
  }
  return undefined;
}

function extractSocialLinks(hrefs: string[]) {
  let instagram: string | undefined;
  let facebook: string | undefined;

  for (const href of hrefs) {
    const unwrapped = unwrapExternalUrl(href);
    if (!unwrapped || !/^https?:\/\//i.test(unwrapped)) continue;
    try {
      const url = new URL(unwrapped);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (!instagram && host.includes("instagram.com")) instagram = cleanExternalUrl(url);
      if (!facebook && host.includes("facebook.com")) facebook = cleanExternalUrl(url);
    } catch {
      continue;
    }
  }

  return { instagram, facebook };
}

function extractPhoneFromHrefs(hrefs: string[]) {
  const tel = hrefs.find((href) => href.startsWith("tel:"));
  if (!tel) return undefined;
  return normalizeBrazilPhone(tel.replace(/^tel:/i, ""));
}

function unwrapExternalUrl(href: string) {
  try {
    const url = new URL(href);
    const target = url.searchParams.get("q") ?? url.searchParams.get("url");
    if (target && /^https?:\/\//i.test(target)) return target;
    return href;
  } catch {
    return href;
  }
}

function cleanExternalUrl(url: URL) {
  url.hash = "";
  return url.toString();
}

function isGoogleHost(host: string) {
  return host === "google.com" || host.endsWith(".google.com") || host === "google.com.br" || host.endsWith(".google.com.br");
}

function isSocialHost(host: string) {
  return ["instagram.com", "facebook.com", "fb.com", "whatsapp.com", "wa.me"].some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function parseReviewCount(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/\s/g, "");
  const multiplier = /[Kk]$/.test(normalized) ? 1000 : /[Mm]$/.test(normalized) ? 1000000 : 1;
  const numeric = Number(normalized.replace(/[KkMm]$/, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : undefined;
}

function parseCoordinates(href: string) {
  const match = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function stableId(value: string) {
  const match = value.match(/!1s([^!]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]).replace(/[^a-zA-Z0-9_-]/g, "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

