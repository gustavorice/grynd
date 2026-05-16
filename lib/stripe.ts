import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var __stripeClient: Stripe | undefined;
}

function createStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY nao configurada.");
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: {
      name: "Grynd",
      version: "0.1.0"
    }
  });
}

// Lazy proxy: só cria quando a primeira chamada acontece.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!globalThis.__stripeClient) {
      globalThis.__stripeClient = createStripe();
    }
    return Reflect.get(globalThis.__stripeClient, prop, receiver);
  }
});

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

export function getStripePriceId(envKey: string): string {
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `Stripe price ID nao configurado (${envKey}). Crie o produto no Stripe Dashboard e adicione a env.`
    );
  }
  return value;
}
