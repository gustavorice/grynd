/**
 * Helpers anti-SSRF e anti-XSS pra URLs vindas de input do usuário ou
 * de scraping. Bloqueia:
 *  - Schemes nao-http/https (file:, javascript:, data:, gopher:, ftp:, etc.)
 *  - Hostnames em ranges privados/loopback (127/8, 10/8, 172.16/12, 192.168/16,
 *    169.254/16 link-local, fc00::/7, ::1, fe80::/10)
 *  - Hostnames metadata cloud (169.254.169.254 — AWS/GCP/Azure)
 *  - URLs sem TLD claro (intranet single-label)
 *
 * Uso: `if (!isPublicHttpUrl(lead.website)) return;`
 *
 * Limitacao conhecida: nao resolve DNS antes de fetch. Atacante pode
 * controlar um dominio publico que resolve pra IP interno. Pra defesa
 * total precisa hookar o socket connect — fora de escopo. Em pratica,
 * essa primeira camada ja barra 99% dos vetores realistas.
 */

const PRIVATE_IPV4_RANGES: ReadonlyArray<[number, number, number, number, number]> = [
  // [a, b1, b2, mask] — exemplo 10.0.0.0/8 -> [10, 0, 0, 0, 8]
  [10, 0, 0, 0, 8], // private
  [172, 16, 0, 0, 12], // private
  [192, 168, 0, 0, 16], // private
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local + cloud metadata
  [100, 64, 0, 0, 10], // CGNAT
  [0, 0, 0, 0, 8] // "this network"
];

function ipv4ToInt(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((o) => o > 255)) return true; // invalido tratamos como inseguro
  const ip = ipv4ToInt(octets);
  return PRIVATE_IPV4_RANGES.some(([a, b, c, d, mask]) => {
    const network = ipv4ToInt([a, b, c, d]);
    const shift = 32 - mask;
    return (ip >>> shift) === (network >>> shift);
  });
}

function isPrivateIpv6(hostname: string): boolean {
  // hostname IPv6 vem cercado por [] em URL; aqui esperamos o conteudo
  const lower = hostname.toLowerCase();
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
  // fe80::/10 link-local, fc00::/7 unique local
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && isPrivateIpv4(mapped[1])) return true;
  return false;
}

/**
 * Checa se a URL eh publica + http(s). Retorna true so se for SEGURA pra
 * fetch / abrir em browser. Retorna false em qualquer duvida (fail-closed).
 */
export function isPublicHttpUrl(input: string | undefined | null): boolean {
  if (!input || typeof input !== "string") return false;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }

  // Apenas http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // Sem hostname
  const hostname = url.hostname.toLowerCase();
  if (!hostname) return false;

  // localhost por nome
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (hostname === "broadcasthost") return false;

  // IPv6 entre colchetes na URL — url.hostname jah devolve sem []
  if (hostname.includes(":")) {
    if (isPrivateIpv6(hostname)) return false;
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) return false;
  } else {
    // Dominio sem ponto (intranet single-label): rejeita
    if (!hostname.includes(".")) return false;
  }

  return true;
}

/**
 * Como isPublicHttpUrl mas tambem exige que o hostname final case com algum
 * sufixo permitido (eg "google.com", "google.com.br"). Pra evitar tricks
 * como `https://evil.com/?google.com/maps`.
 */
export function isPublicHttpUrlOnHosts(
  input: string | undefined | null,
  allowedSuffixes: string[]
): boolean {
  if (!isPublicHttpUrl(input)) return false;
  const url = new URL(input as string);
  const host = url.hostname.toLowerCase();
  return allowedSuffixes.some((suffix) => {
    const s = suffix.toLowerCase();
    return host === s || host.endsWith(`.${s}`);
  });
}

/**
 * Sanitiza href de input do usuario pra renderizar em <a href>. Retorna a URL
 * se for http(s) publica, ou undefined senao. Bloqueia javascript:, data:,
 * file:, etc. Use no client antes de spread em props de <a>.
 */
export function safeExternalHref(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  // Aceita tambem URLs sem protocolo (instagram.com/x) — antepoe https://
  let candidate = input.trim();
  if (!/^https?:\/\//i.test(candidate) && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  return isPublicHttpUrl(candidate) ? candidate : undefined;
}
