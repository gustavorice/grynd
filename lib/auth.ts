import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
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

  // 1) Tenta achar por ID — caminho feliz (user já existe)
  const byId = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (byId[0]) return byId[0];

  // 2) User novo — pega dados do Clerk
  const clerk = await currentUser();
  if (!clerk) throw new AuthError("Sessao Clerk invalida.");

  const email =
    clerk.emailAddresses.find((e) => e.id === clerk.primaryEmailAddressId)?.emailAddress ??
    clerk.emailAddresses[0]?.emailAddress;
  if (!email) throw new AuthError("Usuario sem e-mail no Clerk.");

  const fullName = [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null;
  const imageUrl = clerk.imageUrl || null;

  // 3) Se já existe um user com este email mas ID diferente, migra o ID
  //    (caso típico: troca de instância Clerk dev↔prod com mesmo email).
  //    Atualizar o PK em cascata via UPDATE em users e ajustar FKs manualmente
  //    seria complexo — em vez disso, retornamos o user antigo e atualizamos
  //    o id pra refletir a sessão atual.
  const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail[0]) {
    // Atualiza in-place: o user existente passa a ter o novo userId do Clerk.
    // FKs com ON DELETE CASCADE não bloqueiam UPDATE de PK porque não há ON UPDATE.
    // Solução robusta: usar transação que atualiza users.id e todas as FKs.
    await db.transaction(async (tx) => {
      const oldId = byEmail[0].id;
      // Cria novo row com o novo id, copiando os dados
      await tx
        .insert(users)
        .values({
          id: userId,
          email,
          fullName: fullName ?? byEmail[0].fullName,
          imageUrl: imageUrl ?? byEmail[0].imageUrl,
          plan: byEmail[0].plan
        })
        .onConflictDoNothing();
      // Migra todas as FKs do oldId pro userId. Usamos SQL bruto pra UPDATEs em
      // todas as tabelas que referenciam users.id.
      await tx.execute(sql`UPDATE subscriptions SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE search_quota SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE addon_purchases SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE search_history SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE leads SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE company_profile SET user_id = ${userId} WHERE user_id = ${oldId}`);
      // Apaga o registro antigo
      await tx.delete(users).where(eq(users.id, oldId));
    });

    const migrated = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (migrated[0]) return migrated[0];
  }

  // 4) User totalmente novo — INSERT simples
  const inserted = await db
    .insert(users)
    .values({
      id: userId,
      email,
      fullName,
      imageUrl,
      plan: "free"
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, fullName, imageUrl, updatedAt: new Date() }
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
