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

const SERVERLESS_ARGS_EXTRA = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox"
];

const LOCAL_ARGS = ["--disable-blink-features=AutomationControlled", "--no-sandbox"];

/**
 * Detecta o ambiente:
 * - Vercel / AWS Lambda → usa @sparticuz/chromium (Chromium otimizado pra serverless)
 * - Local (dev / Fly.io com Playwright base image) → usa Chrome/Edge instalado
 */
export async function launchBrowser() {
  const { chromium } = await import("playwright-core");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    const executablePath = await sparticuz.executablePath();
    return chromium.launch({
      args: [...sparticuz.args, ...SERVERLESS_ARGS_EXTRA],
      executablePath,
      headless: true
    });
  }

  const executablePath = LOCAL_BROWSER_PATHS.find((item) => existsSync(item));
  if (!executablePath) {
    throw new Error(
      "Chrome ou Edge nao encontrado pra scraping. Em dev: instale Chrome. Em prod: defina VERCEL=1."
    );
  }
  return chromium.launch({ executablePath, headless: true, args: LOCAL_ARGS });
}
