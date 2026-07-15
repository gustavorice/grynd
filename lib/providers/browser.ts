import { existsSync } from "node:fs";

const LOCAL_BROWSER_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser"
];

// Args adicionais pra rodar headless em serverless.
const SERVERLESS_EXTRA_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--single-process",
  "--no-zygote"
];

const LOCAL_ARGS = ["--disable-blink-features=AutomationControlled", "--no-sandbox"];

const isServerless = (): boolean =>
  Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * O scraping via Playwright/@sparticuz/chromium precisa de ~3 GB de RAM e
 * até 5 min de execução — recursos que SÓ existem no Vercel Pro. No plano
 * Hobby (60s, memória default) o Chromium nem inicia.
 *
 * Por isso ele fica atrás de uma flag explícita `ENABLE_BROWSER_SCRAPE`.
 * - Desligado (default): busca profunda usa SerpAPI + OSM (ambos HTTP, rodam
 *   em qualquer plano). Nada de Chromium.
 * - Ligado (`ENABLE_BROWSER_SCRAPE=true`): usa Playwright — só ligue no Pro,
 *   com vercel.json configurando memory 3008 + maxDuration 300.
 *
 * Em dev local (fora de serverless) fica sempre habilitado — usa o Chrome
 * instalado, sem custo de memória serverless.
 */
export const browserScrapeEnabled = (): boolean => {
  if (!isServerless()) return true; // dev local usa Chrome instalado
  return process.env.ENABLE_BROWSER_SCRAPE === "true";
};

/**
 * Lança um browser Playwright. Detecta ambiente:
 * - Vercel / AWS Lambda → @sparticuz/chromium (Chromium otimizado pra serverless)
 * - Local → Chrome/Edge instalado
 *
 * Faz retry uma vez se o launch falhar (cold start pode demorar).
 */
export async function launchBrowser() {
  const { chromium } = await import("playwright-core");

  if (isServerless()) {
    return launchServerless(chromium);
  }

  const executablePath = LOCAL_BROWSER_PATHS.find((item) => existsSync(item));
  if (!executablePath) {
    throw new Error(
      "Chrome ou Edge nao encontrado pra scraping. Em dev: instale Chrome. Em prod: defina VERCEL=1."
    );
  }
  return chromium.launch({ executablePath, headless: true, args: LOCAL_ARGS });
}

async function launchServerless(chromium: typeof import("playwright-core").chromium) {
  const sparticuz = (await import("@sparticuz/chromium")).default;

  // Pré-aquece o binário do Chromium em /tmp — Vercel reaproveita entre invocações.
  const t0 = Date.now();
  let executablePath: string;
  try {
    executablePath = await sparticuz.executablePath();
    console.log(
      "[browser] sparticuz executable resolved in",
      Date.now() - t0,
      "ms ::",
      executablePath
    );
  } catch (err) {
    console.error("[browser] sparticuz executablePath failed:", err);
    throw new Error(
      `Chromium binary não disponível: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Args do sparticuz + nossos extras pra estabilidade.
  const args = Array.from(new Set([...sparticuz.args, ...SERVERLESS_EXTRA_ARGS]));

  // Tenta launch. Se falhar, espera 1s e tenta de novo.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const t1 = Date.now();
      const browser = await chromium.launch({
        args,
        executablePath,
        headless: true,
        timeout: 45000 // mais tempo pra Vercel cold start
      });
      console.log("[browser] launch ok attempt", attempt, "in", Date.now() - t1, "ms");
      return browser;
    } catch (err) {
      console.error("[browser] launch attempt", attempt, "failed:", err);
      if (attempt === 2) {
        throw new Error(
          `Falha ao iniciar Chromium serverless após 2 tentativas: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("unreachable");
}
