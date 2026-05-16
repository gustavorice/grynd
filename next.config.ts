import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  // Pacotes server-only que não precisam ir pro client bundle.
  serverExternalPackages: [
    "playwright-core",
    "@neondatabase/serverless",
    "drizzle-orm",
    "stripe"
  ],
  // Headers de segurança.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
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
