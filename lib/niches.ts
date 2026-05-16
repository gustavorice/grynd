/**
 * Catálogo de nichos pra prospecção local no Brasil.
 *
 * Cada entrada mapeia uma chave (normalizada, sem acentos, lowercase)
 * pra uma lista de termos que serão usados nas queries de busca e no
 * filtro de match dos resultados.
 *
 * Quando o usuário digita um nicho que não está aqui, caímos no fallback
 * (gera variações genéricas como "X em Y", "melhores X", etc) e o filtro
 * de match fica mais permissivo.
 */
export const NICHE_CATALOG: Record<string, string[]> = {
  // ========= COMIDA E BEBIDA =========
  sorveteria: ["sorveteria", "sorvete", "gelateria", "gelato", "acai", "ice cream", "milk shake"],
  acai: ["acai", "açai", "açaí", "sorveteria", "ice cream"],
  hamburgueria: [
    "hamburgueria",
    "hamburger",
    "burger",
    "smash burger",
    "lanchonete",
    "fast food",
    "lanche"
  ],
  pizzaria: ["pizzaria", "pizza", "pizzaiolo", "pizza italiana", "rodizio de pizza"],
  padaria: ["padaria", "padaria artesanal", "panificadora", "confeitaria", "padaria boutique"],
  confeitaria: ["confeitaria", "doceria", "doces", "bolo personalizado", "brigaderia"],
  lanchonete: ["lanchonete", "lanche", "lanchonete express", "salgaderia", "salgados"],
  cafeteria: ["cafeteria", "cafe", "coffee shop", "coffee", "espresso bar"],
  bar: ["bar", "pub", "cervejaria", "boteco", "petiscaria"],
  restaurante: [
    "restaurante",
    "restaurant",
    "comida caseira",
    "self service",
    "self-service",
    "marmita"
  ],
  churrascaria: ["churrascaria", "churrasco", "rodizio", "picanharia", "espetinho"],
  pastelaria: ["pastelaria", "pastel", "pastel feira"],
  doceria: ["doceria", "doces", "bombons", "brigaderia", "confeitaria"],
  sushi: ["sushi", "comida japonesa", "japonesa", "temaki", "temakeria", "kaiten"],
  pizzaiolo: ["pizzaria", "pizza"],
  comidajaponesa: ["comida japonesa", "sushi", "temaki", "yakisoba"],
  cervejaria: ["cervejaria", "cervejaria artesanal", "chopperia", "brewpub"],
  brigadeiro: ["brigaderia", "doceria", "doces gourmet"],

  // ========= BELEZA E SAÚDE =========
  barbearia: ["barbearia", "barbeiro", "barber shop", "barberia"],
  saodeleza: ["salao de beleza", "cabeleireiro", "salao", "hair studio"],
  cabeleireiro: ["cabeleireiro", "salao de beleza", "salao"],
  estetica: ["estetica", "clinica de estetica", "estetica facial", "estetica corporal", "spa estetico"],
  spa: ["spa", "day spa", "massagem", "massoterapia", "spa urbano"],
  manicure: ["manicure", "nail design", "esmalteria", "nail studio"],
  depilacao: ["depilacao", "depilacao a laser", "depilacao com cera"],
  tatuagem: ["tatuagem", "tattoo", "tattoo studio", "estudio de tatuagem", "piercing"],
  otica: ["otica", "ótica", "oculos", "lentes de contato"],
  petshop: ["pet shop", "petshop", "banho e tosa", "veterinario", "agropet"],
  veterinario: ["veterinario", "clinica veterinaria", "hospital veterinario"],

  // ========= MODA E VAREJO =========
  loja: ["loja", "boutique", "loja de roupas"],
  lojaderoupas: [
    "loja de roupas",
    "moda feminina",
    "moda masculina",
    "boutique",
    "loja de moda",
    "vestuario"
  ],
  modafeminina: ["moda feminina", "loja feminina", "boutique feminina", "roupas femininas"],
  modamasculina: ["moda masculina", "loja masculina", "roupas masculinas"],
  modainfantil: ["moda infantil", "roupas infantis", "loja infantil"],
  modafitness: ["moda fitness", "roupas fitness", "academia store", "fitness wear"],
  calcados: ["calcados", "sapataria", "tenis store", "loja de sapatos"],
  joalheria: ["joalheria", "joias", "ourivesaria", "ouro"],
  bijuteria: ["bijuteria", "acessorios", "semijoias"],
  noivas: ["noivas", "vestidos de noiva", "casa de noivas", "moda festa"],
  brecho: ["brecho", "bazar", "roupas usadas", "segunda mao"],

  // ========= CASA E CONSTRUÇÃO =========
  movel: ["moveis", "loja de moveis", "moveis planejados", "movelaria"],
  decoracao: ["decoracao", "loja de decoracao", "casa e decoracao"],
  construcao: [
    "material de construcao",
    "loja de construcao",
    "materiais de construcao",
    "depósito de construcao",
    "ferragens"
  ],
  ferramenta: ["ferramentas", "loja de ferramentas", "ferragista"],
  tinta: ["tintas", "loja de tintas", "tintas decorativas"],
  piso: ["piso", "revestimentos", "porcelanato", "ceramica"],
  marcenaria: ["marcenaria", "moveis sob medida", "carpinteiro"],

  // ========= SERVIÇOS PROFISSIONAIS =========
  contador: ["contador", "contabilidade", "escritorio contabil"],
  imobiliaria: ["imobiliaria", "corretor de imoveis", "imoveis"],
  arquitetura: ["arquitetura", "arquiteto", "escritorio de arquitetura"],
  engenharia: ["engenharia", "engenheiro civil", "construtora"],
  advogado: ["advogado", "advocacia", "escritorio de advocacia", "juridico"],
  agenciademarketing: [
    "agencia de marketing",
    "marketing digital",
    "agencia de publicidade",
    "agencia digital"
  ],

  // ========= SAÚDE =========
  dentista: ["dentista", "odontologia", "clinica odontologica", "consultorio odontologico"],
  medico: ["medico", "consultorio medico", "clinica medica"],
  clinica: ["clinica", "consultorio", "clinica medica", "policlinica"],
  psicologo: ["psicologo", "psicologia", "clinica de psicologia", "terapia"],
  nutricionista: ["nutricionista", "nutricao", "consultorio de nutricao"],
  fisioterapia: ["fisioterapia", "fisioterapeuta", "clinica de fisioterapia", "rpg"],
  farmacia: ["farmacia", "drogaria", "farmacia de manipulacao"],
  laboratorio: ["laboratorio", "laboratorio de analises", "exames clinicos"],

  // ========= EDUCAÇÃO =========
  escola: ["escola", "colegio", "ensino fundamental", "ensino medio"],
  faculdade: ["faculdade", "universidade", "centro universitario"],
  cursodeingles: ["curso de ingles", "escola de idiomas", "ingles", "escola de ingles"],
  escolainfantil: ["escola infantil", "bercario", "educacao infantil", "creche"],
  escoladedanca: ["escola de danca", "danca", "academia de danca", "ballet"],
  escoladenmusica: ["escola de musica", "aulas de musica", "professor de musica"],

  // ========= AUTOMOTIVO =========
  oficina: [
    "oficina",
    "oficina mecanica",
    "auto center",
    "mecanica automotiva",
    "auto eletrica"
  ],
  borracharia: ["borracharia", "loja de pneus", "alinhamento e balanceamento"],
  lavajato: ["lava jato", "lavagem de carros", "estetica automotiva", "lava rapido"],
  concessionaria: ["concessionaria", "revenda de carros", "loja de veiculos"],
  chaveiro: ["chaveiro", "chaves", "fechadura"],

  // ========= MERCADO E ALIMENTAÇÃO =========
  mercado: ["mercado", "supermercado", "mercearia", "minimercado", "atacadista"],
  hortifruti: ["hortifruti", "sacolão", "feira", "frutas e verduras"],
  acougue: ["acougue", "açougue", "casa de carnes", "boutique de carnes"],

  // ========= ACADEMIA E ESPORTES =========
  academia: [
    "academia",
    "fitness",
    "crossfit",
    "pilates",
    "yoga",
    "musculacao",
    "personal trainer",
    "treinamento funcional"
  ],
  pilates: ["pilates", "studio de pilates", "academia de pilates"],
  crossfit: ["crossfit", "box de crossfit", "treinamento funcional"],
  artesmarciais: [
    "artes marciais",
    "jiu jitsu",
    "muay thai",
    "boxe",
    "karate",
    "judo",
    "dojo"
  ],
  natacao: ["natacao", "escola de natacao", "piscina"],

  // ========= HOTELARIA E TURISMO =========
  hotel: ["hotel", "pousada", "hostel", "motel", "hotel boutique"],
  pousada: ["pousada", "hotel", "hospedagem"],
  buffet: ["buffet", "buffet infantil", "casa de festas", "salao de festas"],
  agenciadeviagens: ["agencia de viagens", "agencia de turismo", "viagens"],

  // ========= TECNOLOGIA E SERVIÇOS DIGITAIS =========
  assistenciatecnica: [
    "assistencia tecnica",
    "conserto de celular",
    "conserto de computador",
    "assistencia de notebook"
  ],
  grafica: ["grafica", "copiadora", "impressao digital", "papelaria"],
  fotografo: ["fotografo", "estudio fotografico", "fotografia", "foto e video"],

  // ========= OUTROS COMUNS =========
  alfaiate: ["alfaiate", "costureira", "ajustes de roupas", "costura"],
  floricultura: ["floricultura", "flores", "buques", "arranjos florais"],
  costureira: ["costureira", "ajustes", "alfaiate"],
  sapataria: ["sapataria", "conserto de sapatos", "sapateiro"]
};

/**
 * Termos genéricos que indicam um negócio — usados como fallback quando
 * o nicho não está no catálogo. Combina com o termo do usuário pra criar
 * variações de busca.
 */
export const GENERIC_BUSINESS_HINTS = [
  "loja de",
  "estudio de",
  "casa de",
  "centro de",
  "clinica de",
  "escola de"
];

/**
 * Normaliza nicho (sem acento, lowercase, sem espaços extras) pra lookup.
 */
export function normalizeNicheKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Lista de termos pra buscar de um nicho (catálogo + fallback).
 */
export function getNicheTerms(niche: string): string[] {
  const key = normalizeNicheKey(niche);
  const singularKey = key.endsWith("s") ? key.slice(0, -1) : key;

  const fromCatalog = NICHE_CATALOG[key] ?? NICHE_CATALOG[singularKey] ?? [];

  // Sempre inclui o termo original do usuário também — capturar grafias
  // exatas que ele/ela digitou.
  const explicit = [niche.trim(), niche.trim().endsWith("s") ? niche.trim().slice(0, -1) : null]
    .filter(Boolean) as string[];

  return Array.from(new Set([...explicit, ...fromCatalog]));
}

/**
 * Termos de match pra um nicho — usado pra filtrar resultados da busca.
 * Mais permissivo que getNicheTerms: inclui radicais parciais.
 */
export function getNicheMatchTerms(niche: string): string[] {
  const terms = getNicheTerms(niche).map((t) => t.toLowerCase());
  // Adiciona o radical (primeiros 5-7 chars) pra capturar variações:
  // "hamburgueria" → "hamburg" cobre "hamburger", "hamburguer", etc.
  const roots = terms
    .map((t) => t.replace(/[^a-z]+/g, ""))
    .filter((t) => t.length >= 5)
    .map((t) => t.slice(0, Math.min(7, t.length)));
  return Array.from(new Set([...terms, ...roots]));
}
