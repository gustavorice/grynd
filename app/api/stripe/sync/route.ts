import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { safeError } from "@/lib/errors";
import { planFromStripePriceId } from "@/lib/plans";
import { applyPlanChange } from "@/lib/quota";
import { enforceApiLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";

/**
 * Sincroniza o estado da subscription do Stripe pro nosso DB.
 *
 * Por que existe: em dev local não temos endpoint público pro Stripe enviar
 * webhook. Quando o user volta do checkout (?billing=success), o frontend
 * chama esse endpoint pra puxar o estado atual e atualizar o plano.
 *
 * Em produção continua usando o webhook (mais confiável, em tempo real),
 * mas esse endpoint funciona como fallback se o webhook estiver atrasado.
 */
export async function POST() {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const sub = (
      await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    )[0];
    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ ok: true, plan: "free", reason: "Sem customer Stripe ainda." });
    }

    // Pega a sub ativa mais recente do customer.
    const list = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      limit: 5,
      status: "all"
    });

    const live = list.data
      .filter((s) => ["active", "trialing", "past_due"].includes(s.status))
      .sort((a, b) => b.created - a.created)[0];

    if (!live) {
      // Nenhuma sub ativa — garante Free
      await db
        .update(subscriptions)
        .set({ plan: "free", status: "canceled", updatedAt: new Date() })
        .where(eq(subscriptions.userId, user.id));
      await applyPlanChange(user.id, "free");
      return NextResponse.json({ ok: true, plan: "free" });
    }

    const priceId = live.items.data[0]?.price.id ?? null;
    const plan = planFromStripePriceId(priceId);

    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId: live.id,
        stripePriceId: priceId,
        plan,
        status: live.status,
        currentPeriodStart: live.current_period_start
          ? new Date(live.current_period_start * 1000)
          : null,
        currentPeriodEnd: live.current_period_end ? new Date(live.current_period_end * 1000) : null,
        cancelAtPeriodEnd: live.cancel_at_period_end,
        canceledAt: live.canceled_at ? new Date(live.canceled_at * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.userId, user.id));

    await applyPlanChange(user.id, plan);

    return NextResponse.json({ ok: true, plan, status: live.status });
  } catch (error) {
    return safeError(error, "Erro ao sincronizar.");
  }
}
