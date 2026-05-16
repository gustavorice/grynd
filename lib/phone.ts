// DDDs válidos no Brasil (ANATEL). Mantido como Set para checagem rápida.
const VALID_DDDS = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99"
]);

/**
 * Normaliza um telefone brasileiro para o formato esperado pela WhatsApp Cloud API:
 * `55DDDNUMERO` (12 dígitos para fixo, 13 para celular).
 * Retorna `undefined` se o DDD for inválido ou o comprimento não bater.
 */
export function normalizeBrazilPhone(value?: string | null): string | undefined {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, "");
  if (!digits) return undefined;

  // Tira prefixo internacional 0055.
  if (digits.startsWith("0055")) digits = digits.slice(4);
  // Já vem com 55 do início.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // Tira zero à esquerda (formato 0DDD...).
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length !== 10 && digits.length !== 11) return undefined;
  const ddd = digits.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) return undefined;

  // Celular tem que começar com 9 depois do DDD.
  if (digits.length === 11 && digits[2] !== "9") return undefined;

  return `55${digits}`;
}

/**
 * Extrai o primeiro telefone brasileiro encontrado num texto livre.
 * Útil pra processar texto do Google Maps ou HTML cru.
 */
export function extractBrazilPhone(text: string): string | undefined {
  // Match padrões comuns: (DD) 9XXXX-XXXX, +55 DD 9XXXX-XXXX, DD9XXXXXXXX, etc.
  const candidates = text.match(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4}/g) ?? [];
  for (const candidate of candidates) {
    const normalized = normalizeBrazilPhone(candidate);
    if (normalized) return normalized;
  }
  return undefined;
}
