import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'standalone' só pra Docker (Fly.io). Vercel infere o melhor output sozinho.
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" as const } : {}),
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  // Pacotes server-only que não precisam ir pro client bundle.
  serverExternalPackages: [
    "playwright-core",
    "@sparticuz/chromium",
    "@neondatabase/serverless",
    "drizzle-orm",
    "stripe"
  ],
  // Headers de segurança.
  async headers() {
    // CSP: allowlist explícito pros providers que carregam JS/imagens externos.
    // - Clerk: scripts + frames pra fluxo de auth
    // - Stripe: scripts + frames pro checkout/portal
    // - Vercel Analytics: opcional, já incluso no Pro
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.grynd.com.br https://js.stripe.com https://challenges.cloudflare.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: ",
      "connect-src 'self' https://*.clerk.accounts.dev https://clerk.grynd.com.br https://api.stripe.com https://*.upstash.io https://*.neon.tech https://nominatim.openstreetmap.org https://overpass-api.de https://places.googleapis.com https://serpapi.com https://va.vercel-scripts.com",
      "frame-src https://*.clerk.accounts.dev https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp }
        ]
      },
      {
        // Webhook precisa do body cru pra Stripe assinar — sem cache.
        source: "/api/stripe/webhook",
        headers: [{ key: "Cache-Control", value: "no-store" }]
      }
    ];
  }
};

export default nextConfig;
