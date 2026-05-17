import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { safeError } from "@/lib/errors";
import { ADDON_200_SEARCHES, PLANS, type PlanId } from "@/lib/plans";
import { enforceApiLimit } from "@/lib/rate-limit";
import { getStripePriceId, stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const plan = user.plan as PlanId;
    if (!ADDON_200_SEARCHES.eligiblePlans.includes(plan)) {
      throw new Error(
        `Compra de pacotes extras esta disponivel apenas no plano ${PLANS.pro.name}. Faca upgrade primeiro.`
      );
    }

    const priceId = getStripePriceId(ADDON_200_SEARCHES.stripePriceEnv);
    const baseUrl = getBaseUrl(request);

    const sub = (
      await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    )[0];
    if (!sub?.stripeCustomerId) throw new Error("Cliente Stripe nao encontrado.");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: sub.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        metadata: {
          userId: user.id,
          sku: ADDON_200_SEARCHES.id,
          searches: String(ADDON_200_SEARCHES.searches)
        }
      },
      metadata: {
        userId: user.id,
        sku: ADDON_200_SEARCHES.id,
        searches: String(ADDON_200_SEARCHES.searches)
      },
      success_url: `${baseUrl}/app?addon=success`,
      cancel_url: `${baseUrl}/app?addon=canceled`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return safeError(error, "Erro ao gerar checkout do addon.");
  }
}

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}
