import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";
import { getStripePriceId, stripe } from "@/lib/stripe";

const BodySchema = z.object({
  plan: z.enum(["pro", "agency"])
});

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      success_url: `${baseUrl}/?billing=success`,
      cancel_url: `${baseUrl}/?billing=canceled`,
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan }
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Erro no checkout." },
    { status: 400 }
  );
}
