import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { searchQuota, users } from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron mensal — chamado todo dia 1 às 03:00 UTC (configurado em vercel.json).
 *
 * Garante que cada usuário tem uma row de search_quota pro período atual,
 * com os limites corretos do plano. Funciona como fallback caso webhook
 * invoice.payment_succeeded falhe ou demore.
 *
 * Protegido por CRON_SECRET — Vercel passa header `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  const allUsers = await db.select({ id: users.id, plan: users.plan }).from(users);
  let processed = 0;
  let errors = 0;

  for (const user of allUsers) {
    try {
      const plan = PLANS[user.plan as PlanId];
      await db
        .insert(searchQuota)
        .values({
          userId: user.id,
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
      processed += 1;
    } catch (err) {
      errors += 1;
      console.error("[cron reset-quotas] erro pra", user.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString()
  });
}
