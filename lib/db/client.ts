import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: DbClient | undefined;
}

function createClient(): DbClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL nao configurada. Defina a env com o connection string do Neon.");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

// Lazy: só conecta quando a primeira query for feita, não em import time.
// Isso evita falha de build quando NEXT coleta page data sem env real.
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    if (!globalThis.__dbClient) {
      globalThis.__dbClient = createClient();
    }
    return Reflect.get(globalThis.__dbClient, prop, receiver);
  }
});

export { schema };
