import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type DbUser } from "@/lib/db/schema";

/**
 * Pega o userId do Clerk a partir da sessão atual (server-side).
 * Lança erro se não autenticado.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session.userId) {
    throw new AuthError("Nao autenticado.");
  }
  return session.userId;
}

/**
 * Versão não-lançante: retorna userId ou null.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session.userId ?? null;
}

/**
 * Garante que o usuário existe no nosso banco. Se for primeiro login, cria.
 * Idempotente — pode ser chamado em todo request autenticado.
 */
export async function getOrSyncUser(): Promise<DbUser> {
  const userId = await requireUserId();
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing[0]) return existing[0];

  const clerk = await currentUser();
  if (!clerk) throw new AuthError("Sessao Clerk invalida.");

  const email =
    clerk.emailAddresses.find((e) => e.id === clerk.primaryEmailAddressId)?.emailAddress ??
    clerk.emailAddresses[0]?.emailAddress;
  if (!email) throw new AuthError("Usuario sem e-mail no Clerk.");

  const inserted = await db
    .insert(users)
    .values({
      id: userId,
      email,
      fullName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null,
      imageUrl: clerk.imageUrl || null,
      plan: "free"
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        fullName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null,
        imageUrl: clerk.imageUrl || null,
        updatedAt: new Date()
      }
    })
    .returning();

  return inserted[0];
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
