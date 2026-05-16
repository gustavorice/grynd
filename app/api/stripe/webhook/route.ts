import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { addonPurchases, stripeEvents, subscriptions } from "@/lib/db/schema";
import { ADDON_200_SEARCHES, planFromStripePriceId } from "@/lib/plans";
import { getStripeWebhookSecret, stripe } from "@/lib/stripe";
import { applyPlanChange, grantAddonSearches } from "@/lib/quota";

// Stripe envia o body como texto cru — precisa preservar.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = getStripeWebhookSecret();
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook nao configurado." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: `Assinatura invalida: ${error instanceof Error ? error.message : "?"}` },
      { status: 400 }
    );
  }

  // Idempotência: ignora eventos já processados.
  const seen = await db.select().from(stripeEvents).where(eq(stripeEvents.id, event.id)).limit(1);
  if (seen[0]) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        // Renovação mensal — reseta uso.
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // ignora outros
        break;
    }

    await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stripe webhook] erro processando", event.type, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no webhook." },
      { status: 500 }
    );
  }
}

// =========================
// handlers
// =========================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Modo "payment" = compra avulsa (add-on).
  if (session.mode === "payment") {
    const sku = session.metadata?.sku;
    const searches = Number(session.metadata?.searches ?? 0);
    if (sku === ADDON_200_SEARCHES.id && searches > 0) {
      const inserted = await db
        .insert(addonPurchases)
        .values({
          userId,
          sku,
          searchesAdded: searches,
          pricePaidCents: session.amount_total ?? ADDON_200_SEARCHES.priceCents,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          stripeCheckoutSessionId: session.id
        })
        .onConflictDoNothing({ target: addonPurchases.stripeCheckoutSessionId })
        .returning();

      if (inserted.length > 0) {
        await grantAddonSearches(userId, searches);
      }
    }
    return;
  }

  // Modo "subscription" — Stripe vai enviar customer.subscription.created/updated separadamente.
  // Nada a fazer aqui além de logar (o subscription handler trata o resto).
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userRow = (
    await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1)
  )[0];
  if (!userRow) return;

  const priceId = sub.items.data[0]?.price.id ?? null;
  const plan = planFromStripePriceId(priceId);

  await db
    .update(subscriptions)
    .set({
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeCustomerId, customerId));

  // Aplica plano e reseta quota se assinatura está ativa.
  if (sub.status === "active" || sub.status === "trialing") {
    await applyPlanChange(userRow.userId, plan);
  } else if (sub.status === "canceled" || sub.status === "unpaid") {
    await applyPlanChange(userRow.userId, "free");
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userRow = (
    await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1)
  )[0];
  if (!userRow) return;

  await db
    .update(subscriptions)
    .set({
      plan: "free",
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeCustomerId, customerId));

  await applyPlanChange(userRow.userId, "free");
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Renovação mensal: Stripe envia invoice.payment_succeeded + customer.subscription.updated.
  // O subscription.updated já reseta a quota via applyPlanChange. Aqui só logamos.
  if (invoice.billing_reason !== "subscription_cycle") return;
  // sub.updated cuida do resto.
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  await db
    .update(subscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptions.stripeCustomerId, customerId));
}
