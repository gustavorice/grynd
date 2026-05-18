import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { safeError } from "@/lib/errors";
import { PLANS, type PlanId } from "@/lib/plans";
import { enforceApiLimit } from "@/lib/rate-limit";
import { getStripePriceId, stripe } from "@/lib/stripe";

const BodySchema = z.object({
  plan: z.enum(["pro", "agency"])
});

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const { plan } = BodySchema.parse(await request.json());
    const planConfig = PLANS[plan as PlanId];
    if (!planConfig.stripePriceEnv) {
      throw new Error("Plano sem preco Stripe configurado.");
    }

    const priceId = getStripePriceId(planConfig.stripePriceEnv);
    const baseUrl = getBaseUrl(request);

    // Garante customer Stripe.
    const existingSub = (
      await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    )[0];

    let customerId = existingSub?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName ?? undefined,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      await db.insert(subscriptions).values({
        userId: user.id,
        stripeCustomerId: customerId,
        plan: "free",
        status: "active"
      });
    }

    // Previne checkout duplicado: se já tem subscription ativa, abre o portal
    // ao invés de criar uma segunda assinatura paralela.
    const activeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5
    });
    if (activeSubs.data.length > 0) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/app`
      });
      return NextResponse.json({
        url: portal.url,
        note: "Você já tem uma assinatura ativa — abrindo o portal pra gerenciar."
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      success_url: `${baseUrl}/app?billing=success`,
      cancel_url: `${baseUrl}/app?billing=canceled`,
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan }
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return safeError(error, "Erro no checkout.");
  }
}

function getBaseUrl(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  // Em prod nao aceitamos fallback pro origin do request — se o Host for
  // manipulado, success_url/cancel_url poderiam apontar pra dominio inimigo.
  if (process.env.VERCEL_ENV === "production") {
    if (!fromEnv) {
      throw new Error("NEXT_PUBLIC_APP_URL nao configurada em producao.");
    }
    return fromEnv;
  }
  return fromEnv ?? new URL(request.url).origin;
}
