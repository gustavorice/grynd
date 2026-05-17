import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOrSyncUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { safeError } from "@/lib/errors";
import { enforceApiLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const sub = (
      await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    )[0];
    if (!sub?.stripeCustomerId) {
      throw new Error("Sem assinatura ativa pra abrir o portal de billing.");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: baseUrl
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return safeError(error, "Erro ao abrir portal.");
  }
}
