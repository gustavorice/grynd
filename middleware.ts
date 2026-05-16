import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook",
  "/api/health"
]);

const isProtectedApiRoute = createRouteMatcher([
  "/api/search(.*)",
  "/api/enrich(.*)",
  "/api/leads(.*)",
  "/api/profile(.*)",
  "/api/send-whatsapp(.*)",
  "/api/stripe/(checkout|portal|addon)(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  if (isProtectedApiRoute(req)) {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return;
  }

  // Rotas restantes (dashboard, etc.) — redireciona pro sign-in.
  await auth.protect();
});

export const config = {
  matcher: [
    // Roda em tudo exceto arquivos estáticos do Next.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
