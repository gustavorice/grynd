import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { searchQuota, users } from "@/lib/db/schema";
import { getPlan, type PlanId } from "@/lib/plans";

export class QuotaError extends Error {
  status = 402; // Payment Required
  constructor(message: string, public readonly remaining: number, public readonly plan: PlanId) {
    super(message);
    this.name = "QuotaError";
  }
}

export type QuotaSnapshot = {
  plan: PlanId;
  periodStart: Date;
  periodEnd: Date;
  searchesIncluded: number;
  searchesUsed: number;
  addonRemaining: number;
  aiInsightsIncluded: number;
  aiInsightsUsed: number;
  searchesAvailable: number;
};

/**
 * Pega o snapshot atual da quota do user. Cria a janela do período se ainda não existir.
 */
export async function getOrCreateQuota(userId: string): Promise<QuotaSnapshot> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("Usuario nao encontrado.");

  const plan = getPlan(user.plan as PlanId);
  const { start, end } = currentPeriodBounds();

  const existing = (
    await db
      .select()
      .from(searchQuota)
      .where(and(eq(searchQuota.userId, userId), eq(searchQuota.periodStart, start)))
      .limit(1)
  )[0];

  if (existing) {
    return snapshot(plan.id, existing);
  }

  // Carry-over de addon do período anterior (não expira).
  const prev = (
    await db
      .select({ addonRemaining: searchQuota.addonRemaining })
      .from(searchQuota)
      .where(eq(searchQuota.userId, userId))
      .orderBy(sql`${searchQuota.periodStart} desc`)
      .limit(1)
  )[0];

  const inserted = (
    await db
      .insert(searchQuota)
      .values({
        userId,
        periodStart: start,
        periodEnd: end,
        searchesIncluded: plan.searchesPerMonth,
        addonRemaining: prev?.addonRemaining ?? 0,
        aiInsightsIncluded: plan.aiInsightsPerMonth === -1 ? 999_999 : plan.aiInsightsPerMonth
      })
      .returning()
  )[0];

  return snapshot(plan.id, inserted);
}

/**
 * Tenta consumir N buscas. Retorna o snapshot atualizado.
 * Lança QuotaError se exceder.
 */
export async function consumeSearch(userId: string, amount = 1): Promise<QuotaSnapshot> {
  const q = await getOrCreateQuota(userId);
  if (q.searchesAvailable < amount) {
    throw new QuotaError(
      `Limite de buscas mensais atingido (${q.searchesUsed}/${q.searchesIncluded}). Faca upgrade ou compre +200 buscas.`,
      q.searchesAvailable,
      q.plan
    );
  }

  // Estratégia: consome primeiro do incluído, depois do addon.
  const fromIncluded = Math.min(amount, q.searchesIncluded - q.searchesUsed);
  const fromAddon = amount - fromIncluded;

  await db
    .update(searchQuota)
    .set({
      searchesUsed: sql`${searchQuota.searchesUsed} + ${fromIncluded}`,
      addonRemaining: sql`${searchQuota.addonRemaining} - ${fromAddon}`,
      updatedAt: new Date()
    })
    .where(and(eq(searchQuota.userId, userId), eq(searchQuota.periodStart, q.periodStart)));

  return {
    ...q,
    searchesUsed: q.searchesUsed + fromIncluded,
    addonRemaining: q.addonRemaining - fromAddon,
    searchesAvailable: q.searchesAvailable - amount
  };
}

/**
 * Idem pra AI insights.
 */
export async function consumeAiInsight(userId: string): Promise<QuotaSnapshot> {
  const q = await getOrCreateQuota(userId);
  if (q.aiInsightsUsed >= q.aiInsightsIncluded) {
    throw new QuotaError(
      `Limite de AI insights atingido (${q.aiInsightsUsed}/${q.aiInsightsIncluded}). Faca upgrade.`,
      0,
      q.plan
    );
  }
  await db
    .update(searchQuota)
    .set({
      aiInsightsUsed: sql`${searchQuota.aiInsightsUsed} + 1`,
      updatedAt: new Date()
    })
    .where(and(eq(searchQuota.userId, userId), eq(searchQuota.periodStart, q.periodStart)));

  return { ...q, aiInsightsUsed: q.aiInsightsUsed + 1 };
}

/**
 * Adiciona buscas do addon ao usuário (chamado pelo webhook do Stripe).
 */
export async function grantAddonSearches(userId: string, amount: number): Promise<void> {
  const q = await getOrCreateQuota(userId);
  await db
    .update(searchQuota)
    .set({
      addonRemaining: sql`${searchQuota.addonRemaining} + ${amount}`,
      updatedAt: new Date()
    })
    .where(and(eq(searchQuota.userId, userId), eq(searchQuota.periodStart, q.periodStart)));
}

/**
 * Reseta a janela quando subscription muda de plano (upgrade/downgrade).
 * Mantém o addon (não expira), zera o uso.
 */
export async function applyPlanChange(userId: string, newPlan: PlanId): Promise<void> {
  await db.update(users).set({ plan: newPlan, updatedAt: new Date() }).where(eq(users.id, userId));

  const plan = getPlan(newPlan);
  const { start, end } = currentPeriodBounds();

  await db
    .insert(searchQuota)
    .values({
      userId,
      periodStart: start,
      periodEnd: end,
      searchesIncluded: plan.searchesPerMonth,
      searchesUsed: 0,
      addonRemaining: 0,
      aiInsightsIncluded: plan.aiInsightsPerMonth === -1 ? 999_999 : plan.aiInsightsPerMonth,
      aiInsightsUsed: 0
    })
    .onConflictDoUpdate({
      target: [searchQuota.userId, searchQuota.periodStart],
      set: {
        searchesIncluded: plan.searchesPerMonth,
        aiInsightsIncluded: plan.aiInsightsPerMonth === -1 ? 999_999 : plan.aiInsightsPerMonth,
        updatedAt: new Date()
      }
    });
}

// =========================
// helpers internos
// =========================

function snapshot(planId: PlanId, row: typeof searchQuota.$inferSelect): QuotaSnapshot {
  const availableFromIncluded = Math.max(0, row.searchesIncluded - row.searchesUsed);
  return {
    plan: planId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    searchesIncluded: row.searchesIncluded,
    searchesUsed: row.searchesUsed,
    addonRemaining: row.addonRemaining,
    aiInsightsIncluded: row.aiInsightsIncluded,
    aiInsightsUsed: row.aiInsightsUsed,
    searchesAvailable: availableFromIncluded + row.addonRemaining
  };
}

function currentPeriodBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}
