import type { CompanySize, Lead } from "@/lib/types";

type PartialLead = Partial<
  Pick<
    Lead,
    | "name"
    | "category"
    | "phone"
    | "whatsapp"
    | "website"
    | "instagram"
    | "email"
    | "rating"
    | "reviewCount"
    | "address"
  >
>;

export function diagnoseLead(lead: PartialLead): Pick<Lead, "score" | "companySize" | "diagnosis" | "nextAction"> {
  let score = 20;
  const signals: string[] = [];
  const gaps: string[] = [];

  if (lead.phone) {
    score += 16;
    signals.push("telefone visivel");
  } else {
    gaps.push("sem telefone");
  }

  if (lead.whatsapp) {
    score += 18;
    signals.push("WhatsApp encontrado");
  }

  if (lead.website) {
    score += 15;
    signals.push("site publicado");
  } else {
    gaps.push("sem site");
  }

  if (lead.instagram) {
    score += 12;
    signals.push("Instagram encontrado");
  }

  if (lead.email) {
    score += 10;
    signals.push("e-mail encontrado");
  }

  if (lead.address) {
    score += 7;
  }

  if (lead.rating && lead.rating >= 4.2) {
    score += 8;
    signals.push("boa avaliacao");
  }

  if (lead.reviewCount && lead.reviewCount >= 30) {
    score += 8;
    signals.push("volume relevante de avaliacoes");
  }

  score = Math.min(score, 100);
  const companySize = inferCompanySize(lead);

  const diagnosis =
    signals.length > 0
      ? `Lead ${score >= 70 ? "quente" : score >= 45 ? "interessante" : "inicial"}: ${signals.join(", ")}. Porte provavel: ${companySize}.`
      : "Lead inicial: dados publicos ainda limitados.";

  let nextAction = "Validar contato e abordar com mensagem curta.";
  if (!lead.website) nextAction = "Priorizar oferta de presenca digital ou criacao de site.";
  if (lead.website && !lead.whatsapp) nextAction = "Checar site e redes para confirmar canal de atendimento.";
  if (lead.whatsapp) nextAction = "Enviar abordagem pelo WhatsApp com contexto do nicho.";
  if (gaps.length >= 2) nextAction = `Enriquecer antes de abordar: ${gaps.join(", ")}.`;

  return { score, companySize, diagnosis, nextAction };
}

// Marcas "grandes" no Brasil — sempre matched com word-boundary,
// nunca por substring (pra evitar conflito com cidades/sobrenomes).
// Removidas marcas curtas/ambíguas (claro, vivo, tim, oi, natura, ale, big, dia, br...) — vão pra CONTEXTUAL_BRANDS.
const LARGE_BRANDS: string[] = [
  // Fast food / rede de restaurantes
  "mc donald", "mcdonald", "mcdonalds", "burger king", "subway", "habib s", "habibs", "china in box",
  "outback", "applebee s", "dominos", "domino s", "pizza hut", "bobs", "giraffas", "popeyes",
  "spoleto", "vivenda do camarao", "jeronimo burger", "montana grill", "fran s cafe", "starbucks",
  "casa do pao de queijo", "rei do mate", "patroni pizza", "divino fogao", "ponto chic",
  "madero", "coco bambu", "outback steakhouse", "abbraccio", "johnny rockets", "taco bell",
  "jin jin", "tendai", "griletto",
  // Doces / cafés / sorveterias / açaí (redes)
  "cacau show", "brasil cacau", "kopenhagen", "lindt", "havanna", "the coffee",
  "bacio di latte", "haagen dazs", "tutti frutti", "amor aos pedacos", "sorvete italia",
  "sorvete soberano", "la basque", "yoggi", "yogoberry", "yopa", "frooty",
  "amazonia acai", "acai concept", "oakberry", "acai da terra", "tropical acai",
  "vivenda do acai", "acai do mato",
  // Varejo / departamento
  "magazine luiza", "magalu", "casas bahia", "ponto frio", "lojas americanas", "americanas s a",
  "renner", "riachuelo", "marisa", "leader", "havan", "hering store", "kalunga",
  "fast shop", "ricardo eletro", "le biscuit", "ri happy", "pbkids", "marisol",
  // Esporte / lazer
  "centauro", "decathlon", "netshoes", "world tennis",
  // Cosméticos / beleza (redes)
  "boticario", "eudora", "mahogany", "jequiti", "avon brasil", "the body shop", "loccitane",
  // Postos de combustivel
  "posto ipiranga", "posto shell", "posto br", "br mania", "br distribuidora",
  "petrobras", "ale combustiveis", "raizen",
  // Bancos / financeiras
  "bradesco", "itau", "santander", "banco do brasil", "caixa economica federal",
  "sicoob", "sicredi", "banrisul", "nubank", "btg pactual", "banco safra", "banco original",
  // Supermercados / atacadistas
  "carrefour", "atacadao", "assai", "sam s club", "walmart", "big bompreco",
  "hortifruti", "pao de acucar", "mambo", "sonda supermercados", "savegnago",
  "tenda atacado", "spani atacadista", "muffato", "supermuffato", "condor",
  "angeloni", "festval", "covabra", "supermercados bh", "tauste", "enxuto",
  "amigao supermercados", "comper",
  // Farmácias / drogarias
  "drogasil", "droga raia", "pague menos", "drogarias sao joao", "drogaria pacheco",
  "panvel", "drogaria nissei", "drogarias venancio", "ultrafarma", "drogaria onofre",
  "drogaria araujo", "extrafarma",
  // Saúde
  "unimed", "hapvida", "amil saude", "notre dame intermedica", "notredame intermedica",
  "sulamerica", "sul america saude", "bradesco saude", "prevent senior", "porto seguro saude",
  // Educação
  "anhanguera", "kroton", "cogna", "estacio", "uninove", "universidade paulista",
  "kumon", "ccaa idiomas", "fisk", "wizard", "yazigi", "english house",
  "berlitz", "cultura inglesa",
  // Academias / fitness
  "smart fit", "bluefit", "blue fit", "selfit", "bodytech", "bio ritmo", "panobianco", "skyfit",
  "ultra academia", "xprime", "contours", "curves", "formula academia",
  "just fit", "movefit", "academia evolution",
  // Mobilidade / locadoras
  "localiza", "movida rent", "hertz brasil", "unidas rent", "avis brasil", "europcar",
  // Pet
  "petz", "cobasi", "pet center marginal", "petlove",
  // Hotéis
  "hotel ibis", "ibis budget", "mercure hotel", "accor hotel", "hilton hotel", "marriott hotel",
  "holiday inn", "atlantica hoteis", "blue tree hotel", "novotel", "ramada hotel",
  "best western", "wyndham hotel", "intercity hotel",
  // Casa / construção
  "tok stok", "tok stock", "leroy merlin", "telhanorte", "casa video", "mobly",
  "madeiramadeira", "obramax", "balaroti", "etna home",
  // Tecnologia / outros varejos
  "fnac", "livraria saraiva", "livraria cultura",
  // Institucional / paraestatal (com espaço pra evitar matching com sobrenome)
  "sesc sp", "sesc rj", "senac sp", "senac rj", "sesi ", "senai ", "sebrae",
  // Concessionárias automotivas (sufixo "automoveis" / "veiculos" obrigatório)
  "toyota veiculos", "honda automoveis", "volkswagen veiculos", "chevrolet veiculos",
  "fiat veiculos", "ford veiculos", "hyundai veiculos", "nissan veiculos",
  "renault veiculos", "peugeot veiculos", "citroen veiculos", "kia motors",
  "mercedes benz", "porsche center", "volvo cars",
  // Outros
  "lojas marisa", "lojas leader", "submarino"
];

// Marcas curtas/ambíguas: precisam aparecer COM um termo de contexto
// (loja, celular, telefonia etc) pra contar como "grande". Evita falso positivo
// com nomes de cidade ("Rio Claro"), bairros, sobrenomes etc.
const CONTEXTUAL_BRANDS: { term: string; context: string[] }[] = [
  { term: "claro", context: ["loja", "celular", "telefonia", "operadora", "tim", "vivo", "telecom"] },
  { term: "vivo", context: ["loja", "celular", "telefonia", "operadora", "claro", "tim", "telecom"] },
  { term: "tim", context: ["loja", "celular", "telefonia", "operadora", "claro", "vivo", "telecom"] },
  { term: "oi", context: ["loja oi", "oi loja", "operadora oi"] },
  { term: "natura", context: ["natura cosmeticos", "natura store", "loja natura", "consultora natura"] },
  { term: "raia", context: ["drogaria", "droga raia", "farmacia"] },
  { term: "dia", context: ["supermercado dia", "minimercado dia", "dia supermercado"] },
  { term: "extra", context: ["hipermercado extra", "extra supermercado", "supermercado extra"] },
  { term: "big", context: ["big bompreco", "big supermercado", "atacadista big"] },
  { term: "ale", context: ["posto ale", "ale combustiveis"] }
];

// Sinais que indicam porte médio ou maior. Word-boundary aplicado também.
const MEDIUM_SIGNALS: string[] = [
  "franquia", "unidade ", "matriz", " rede ", "shopping", "hospital", "clinica", "faculdade",
  "universidade", "colegio", "supermercado", "atacarejo", "atacadista", "concessionaria",
  "hotel ", "industria", "industrias", "distribuidora", "tenis clube", "country club",
  " s a ", " s.a", " ltda", "associacao", "cooperativa", "instituto ", "grupo ",
  "holdings", "corporation", "international", "do brasil"
];

const SHOPPING_HINTS: string[] = [
  "shopping ", "outlet ", "galleria ", "iguatemi", "morumbi", "eldorado", "ibirapuera",
  "vila olimpia", "park shopping", "anhembi", "raposo shopping", "tres rios", "vila lobos",
  "patio paulista", "patio higienopolis", "center norte", "tiete plaza", "anália franco",
  "metropole ", "central plaza"
];

const COUNTRY_TLDS = [".com.br", ".com", ".net", ".org"];

export function inferCompanySize(lead: PartialLead): CompanySize {
  const text = normalizeText([lead.name, lead.category, lead.address].filter(Boolean).join(" "));
  const websiteText = normalizeText(lead.website ?? "");
  const reviews = lead.reviewCount ?? 0;

  // Marca grande confirmada por nome → grande, ponto.
  if (matchesAny(text, LARGE_BRANDS)) return "grande";
  if (matchesContextual(text, CONTEXTUAL_BRANDS)) return "grande";

  // Domínios famosos (corp, gov, edu) também indicam estrutura grande.
  if (
    /\b(corp|holdings|sa|s a)\b/.test(text) &&
    COUNTRY_TLDS.some((tld) => websiteText.includes(tld))
  ) {
    return "grande";
  }

  // Endereço em shopping de grande porte sugere ao menos média.
  const inShopping = SHOPPING_HINTS.some((hint) => text.includes(hint));

  // Reviews — thresholds mais sensíveis pro Brasil.
  if (reviews >= 1000) return "grande";
  if (reviews >= 250) {
    // Acima de 250 reviews + sinais de filial/rede/shopping → grande.
    if (inShopping || matchesAny(text, MEDIUM_SIGNALS) || /(filial|unidade|loja)\s*(\d+|[ivxlc]+)/.test(text)) {
      return "grande";
    }
    return "media";
  }
  if (reviews >= 80) return "media";
  if (matchesAny(text, MEDIUM_SIGNALS)) return "media";
  if (inShopping) return "media";
  if (reviews >= 30 && lead.website && (lead.phone || lead.whatsapp)) return "media";
  if (lead.website && lead.instagram && (lead.phone || lead.whatsapp) && reviews >= 15) return "media";

  return "pequena";
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => containsWord(haystack, needle));
}

function matchesContextual(haystack: string, brands: { term: string; context: string[] }[]): boolean {
  return brands.some((brand) => {
    if (!containsWord(haystack, brand.term)) return false;
    return brand.context.some((ctx) => containsWord(haystack, ctx));
  });
}

function containsWord(haystack: string, needle: string): boolean {
  const term = needle.trim();
  if (!term) return false;
  // Word-boundary universal: exige que o termo esteja cercado por não-alfanumérico (ou início/fim).
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`);
  return pattern.test(haystack);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string) {
  return ` ${value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}
