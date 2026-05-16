import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { launchBrowser } from "@/lib/providers/browser";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Endpoint de debug — testa se o Playwright + @sparticuz/chromium consegue
 * iniciar em produção e abrir uma página simples. Retorna timing detalhado
 * e qualquer erro que aconteça.
 *
 * Requer autenticação pra não expor a usuários anônimos.
 */
export async function GET() {
  const timings: Record<string, number> = {};
  const result: Record<string, unknown> = {
    env: {
      vercel: Boolean(process.env.VERCEL),
      vercel_env: process.env.VERCEL_ENV,
      node_env: process.env.NODE_ENV
    },
    timings
  };

  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    timings.launch_ms = Date.now() - t0;
    result.browser_launched = true;

    const t1 = Date.now();
    const page = await browser.newPage();
    timings.new_page_ms = Date.now() - t1;

    const t2 = Date.now();
    await page.goto("https://www.google.com/maps/search/sorveteria+em+Rio+Claro", {
      waitUntil: "domcontentloaded",
      timeout: 25000
    });
    timings.goto_ms = Date.now() - t2;
    result.page_url = page.url();

    const t3 = Date.now();
    const places = await page.locator('a[href*="/maps/place"]').count();
    timings.count_ms = Date.now() - t3;
    result.places_found = places;

    result.success = true;
  } catch (err) {
    result.success = false;
    result.error = err instanceof Error ? err.message : String(err);
    result.error_stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : undefined;
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
    timings.total_ms = Date.now() - t0;
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
