export type PlanId = "free" | "pro" | "agency";

export type PlanFeatures = {
  searchesPerMonth: number;
  aiInsightsPerMonth: number; // -1 = ilimitado
  canExportCsv: boolean;
  canUseWhatsAppCloud: boolean;
  canUseApi: boolean;
};

export type Plan = PlanFeatures & {
  id: PlanId;
  name: string;
  priceCents: number; // em centavos de BRL
  stripePriceEnv: string | null; // env var que contém o price id da Stripe
  addonAvailable: boolean;
};

// ⚠️ Os Price IDs (price_xxx) precisam ser criados manualmente no Stripe Dashboard
// e populados nas envs: STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_AGENCY_MONTHLY, STRIPE_PRICE_ADDON_200.
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    stripePriceEnv: null,
    searchesPerMonth: 30,
    aiInsightsPerMonth: 0,
    canExportCsv: false,
    canUseWhatsAppCloud: false,
    canUseApi: false,
    addonAvailable: false
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 5990,
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
    searchesPerMonth: 500,
    aiInsightsPerMonth: 10,
    canExportCsv: true,
    canUseWhatsAppCloud: false,
    canUseApi: false,
    addonAvailable: true
  },
  agency: {
    id: "agency",
    name: "Agencia",
    priceCents: 19990,
    stripePriceEnv: "STRIPE_PRICE_AGENCY_MONTHLY",
    searchesPerMonth: 5000,
    aiInsightsPerMonth: -1,
    canExportCsv: true,
    canUseWhatsAppCloud: true,
    canUseApi: true,
    addonAvailable: false
  }
};

export const ADDON_200_SEARCHES = {
  id: "addon_200_searches",
  name: "+200 buscas",
  searches: 200,
  priceCents: 2000,
  stripePriceEnv: "STRIPE_PRICE_ADDON_200",
  eligiblePlans: ["pro"] as PlanId[]
};

export function planFromStripePriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY_MONTHLY) return "agency";
  return "free";
}

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId] ?? PLANS.free;
}
