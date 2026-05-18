import { isPublicHttpUrl } from "@/lib/url-safety";

export type Enrichment = {
  email?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  phone?: string;
};

const SOCIAL_LIMIT = 1;
const FETCH_TIMEOUT_MS = 9000;
const SUBPAGE_PATHS = ["", "/contato", "/contact", "/fale-conosco", "/sobre", "/about", "/atendimento"];
const SUBPAGE_LIMIT = 3;

const REALISTIC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function enrichFromWebsite(website?: string): Promise<Enrichment> {
  if (!website) return {};
  const baseUrl = normalizeUrl(website);

  let accumulated: Enrichment = {};
  let attempts = 0;

  for (const path of SUBPAGE_PATHS) {
    if (attempts >= SUBPAGE_LIMIT && hasCoreSignals(accumulated)) break;
    if (attempts >= SUBPAGE_PATHS.length) break;

    const targetUrl = joinUrl(baseUrl, path);
    if (!targetUrl) continue;

    attempts += 1;
    const html = await fetchHtml(targetUrl);
    if (!html) continue;

    accumulated = mergeEnrichment(accumulated, extractContacts(html));
    if (isComplete(accumulated)) break;
  }

  return accumulated;
}

export function extractContacts(html: string): Enrichment {
  const compact = html
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/g, "&");

  const email = matchFirst(compact, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const whatsapp = extractWhatsApp(compact);
  const phone = extractPhoneFromHtml(compact);
  const social = extractSocial(compact);

  return {
    email: email?.toLowerCase(),
    whatsapp,
    phone,
    instagram: social.instagram,
    facebook: social.facebook
  };
}

function extractWhatsApp(html: string): string | undefined {
  // 1) Links diretos do WhatsApp em todos os formatos comuns.
  const directPatterns: RegExp[] = [
    /(?:https?:\/\/)?(?:api\.)?whatsapp\.com\/send\/?\?[^"'\s<>]*phone=(\+?\d{10,15})/i,
    /(?:https?:\/\/)?wa\.me\/(\+?\d{10,15})/i,
    /(?:https?:\/\/)?wa\.me\/message\/([A-Z0-9]+)/i, // só pra detectar; sem telefone
    /(?:https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9]+/i, // link de grupo: indica presença, sem número
    /["'](?:wa|whatsapp|whats|zap)["']?\s*[:=]\s*["']?(\+?\d{10,15})/i
  ];
  for (const pattern of directPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const digits = match[1].replace(/\D/g, "");
      if (digits.length >= 10) return digits;
    }
  }

  // 2) Número próximo à palavra "whatsapp" (ou variantes) no texto/HTML.
  const contextual = html.match(
    /(?:whats\s?app|whatsapp|whats|wpp|zap\s?zap|zap)[^\d<>]{0,40}(\+?\s?5?5?\s?\(?\d{2}\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4})/i
  );
  if (contextual?.[1]) {
    const digits = contextual[1].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) return digits;
  }

  return undefined;
}

function extractPhoneFromHtml(html: string): string | undefined {
  // Links tel: são o sinal mais confiável.
  const telMatch = html.match(/tel:(\+?[\d().\s-]{10,})/i);
  if (telMatch?.[1]) {
    const digits = telMatch[1].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) return digits;
  }

  // Telefone brasileiro em texto: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX
  const brMatch = html.match(/\(?\b([1-9]\d)\)?\s?9?\s?\d{4}[\s.-]?\d{4}\b/);
  if (brMatch) {
    const digits = brMatch[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 11) return digits;
  }

  return undefined;
}

function extractSocial(html: string): { instagram?: string; facebook?: string } {
  // 1) JSON-LD sameAs — onde sites bem feitos declaram redes.
  const jsonLdSocial = extractFromJsonLd(html);

  // 2) URLs diretas.
  const instagramUrl =
    jsonLdSocial.instagram ??
    firstUrl(html, /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?[A-Za-z0-9?=&_-]*/gi) ??
    inferInstagramFromHandle(html);

  const facebookUrl =
    jsonLdSocial.facebook ??
    firstUrl(html, /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?!sharer|share\.php|dialog|tr\?)[A-Za-z0-9.\-_]+\/?/gi) ??
    firstUrl(html, /https?:\/\/(?:www\.)?fb\.com\/[A-Za-z0-9.\-_]+/gi);

  return {
    instagram: instagramUrl,
    facebook: facebookUrl
  };
}

function extractFromJsonLd(html: string): { instagram?: string; facebook?: string } {
  const blocks = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  let instagram: string | undefined;
  let facebook: string | undefined;
  for (const block of blocks) {
    const body = block[1];
    if (!body) continue;
    const sameAsMatches = body.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
    const list = sameAsMatches?.[1] ?? body;
    const urls = Array.from(list.matchAll(/"(https?:\/\/[^"]+)"/g)).map((match) => match[1]);
    for (const url of urls) {
      if (!instagram && /instagram\.com\//i.test(url)) instagram = cleanUrl(url);
      if (!facebook && /facebook\.com\//i.test(url)) facebook = cleanUrl(url);
    }
    if (instagram && facebook) break;
  }
  return { instagram, facebook };
}

function inferInstagramFromHandle(html: string): string | undefined {
  // Captura "@handle" próximo à palavra Instagram.
  const match = html.match(/instagram[^@<>]{0,40}@([A-Za-z0-9._]{2,30})/i);
  if (!match?.[1]) return undefined;
  const handle = match[1].replace(/[._]+$/, "");
  if (!handle) return undefined;
  return `https://instagram.com/${handle}`;
}

function hasCoreSignals(enrichment: Enrichment) {
  return Boolean(enrichment.whatsapp && (enrichment.instagram || enrichment.facebook));
}

function isComplete(enrichment: Enrichment) {
  return Boolean(enrichment.whatsapp && enrichment.instagram && enrichment.facebook && enrichment.email);
}

function mergeEnrichment(a: Enrichment, b: Enrichment): Enrichment {
  return {
    email: a.email ?? b.email,
    whatsapp: a.whatsapp ?? b.whatsapp,
    phone: a.phone ?? b.phone,
    instagram: a.instagram ?? b.instagram,
    facebook: a.facebook ?? b.facebook
  };
}

function matchFirst(html: string, regex: RegExp) {
  return html.match(regex)?.[0];
}

function firstUrl(html: string, regex: RegExp) {
  const matches = Array.from(html.matchAll(regex)).map((match) => cleanUrl(match[0]));
  // Filtra perfis "share", "tr", etc.
  const filtered = matches.filter((url) => !/\/(?:share|sharer|tr|plugins|dialog)/i.test(url));
  return filtered.slice(0, SOCIAL_LIMIT)[0];
}

function cleanUrl(url: string) {
  return url.replace(/[)"'<>,]+$/g, "").replace(/\\\//g, "/");
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function joinUrl(base: string, path: string) {
  if (!path) return base;
  try {
    const url = new URL(path, base);
    return url.toString();
  } catch {
    return undefined;
  }
}

async function fetchHtml(url: string): Promise<string | undefined> {
  // Anti-SSRF: bloqueia file:, javascript:, IPs privados, loopback, metadata cloud.
  // Sem isso, /api/enrich virava proxy pra qualquer URL que o atacante quisesse
  // que o servidor da Vercel chamasse (incluindo metadata 169.254.169.254).
  if (!isPublicHttpUrl(url)) return undefined;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": REALISTIC_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return undefined;
    const text = await response.text();
    return text.length > 2_000_000 ? text.slice(0, 2_000_000) : text;
  } catch {
    return undefined;
  }
}
