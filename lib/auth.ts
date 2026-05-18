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
  try {
    const byId = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (byId[0]) return byId[0];
  } catch (err) {
    console.error("[auth] step1 byId failed for userId=%s:", userId, err);
    throw err;
  }

  // 2) User novo — pega dados do Clerk
  const clerk = await currentUser();
  if (!clerk) throw new AuthError("Sessao Clerk invalida.");

  const primaryEmail =
    clerk.emailAddresses.find((e) => e.id === clerk.primaryEmailAddressId) ??
    clerk.emailAddresses[0];
  const email = primaryEmail?.emailAddress;
  if (!email) {
    console.error(
      "[auth] step2 sem email pra userId=%s — clerk.emailAddresses.length=%d primaryId=%s",
      userId,
      clerk.emailAddresses.length,
      clerk.primaryEmailAddressId
    );
    throw new AuthError("Usuario sem e-mail no Clerk.");
  }

  // CRITICO: só consideramos o email "confiavel" se Clerk confirmou verificacao.
  // Sem isso, alguem poderia criar conta com email de outra pessoa e acionar a
  // migracao de FKs pra ganhar plano/leads alheios. (Em config padrao do Clerk
  // ja exige verificacao antes de criar sessao, mas defesa em profundidade.)
  const emailIsVerified = primaryEmail?.verification?.status === "verified";

  const fullName = [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null;
  const imageUrl = clerk.imageUrl || null;

  // 3) Se já existe um user com este email mas ID diferente, migra o ID
  //    (caso típico: troca de instância Clerk dev↔prod com mesmo email).
  //
  //    Sequência crítica (não pode mudar a ordem):
  //      a) Renomeia o email do user antigo pra um placeholder. Isso libera
  //         a constraint UNIQUE de users.email pro novo registro.
  //      b) INSERE o novo user com o email "limpo".
  //      c) Migra todas as FKs (subscriptions, search_quota, etc.) pro novo id.
  //      d) DELETA o registro antigo (já sem FKs apontando pra ele).
  //
  //    Se rodar tudo numa transação, ou tudo passa ou nada acontece — sem
  //    estados intermediários expostos.
  //
  //    Defesa anti-takeover (critica): só migra se o email do user logado for
  //    verificado no Clerk. Sem isso, alguem poderia criar conta com email de
  //    outra pessoa e ganhar plano/leads alheios.
  let byEmail: DbUser[];
  try {
    byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  } catch (err) {
    console.error("[auth] step3 byEmail failed for userId=%s email=%s:", userId, email, err);
    throw err;
  }

  console.error(
    "[auth] step3 ok userId=%s emailVerified=%s byEmailMatch=%s",
    userId,
    emailIsVerified,
    byEmail[0] ? `oldId=${byEmail[0].id}` : "none"
  );

  if (byEmail[0] && !emailIsVerified) {
    // Email ja registrado por outra conta E o usuario logado nao verificou esse
    // email. Recusa criacao pra impedir takeover. Em prod o Clerk default ja
    // bloqueia esse path (sessao exige verify), mas defesa em profundidade.
    throw new AuthError(
      "Esse e-mail ja esta em uso e o seu nao foi verificado. Verifique o seu e-mail pra continuar."
    );
  }

  if (byEmail[0]) {
    const oldId = byEmail[0].id;
    const oldFullName = byEmail[0].fullName;
    const oldImageUrl = byEmail[0].imageUrl;
    const oldPlan = byEmail[0].plan;
    const placeholderEmail = `migrating-${oldId}-${Date.now()}@grynd.invalid`;

    console.error("[auth] step4 migracao oldId=%s -> newId=%s", oldId, userId);

    try {
      await db.transaction(async (tx) => {
      // (a) Libera o email do registro antigo
      await tx
        .update(users)
        .set({ email: placeholderEmail, updatedAt: new Date() })
        .where(eq(users.id, oldId));

      // (b) Cria o novo registro com o email original
      await tx.insert(users).values({
        id: userId,
        email,
        fullName: fullName ?? oldFullName,
        imageUrl: imageUrl ?? oldImageUrl,
        plan: oldPlan
      });

      // (c) Migra todas as FKs do oldId pro novo userId
      await tx.execute(sql`UPDATE subscriptions SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE search_quota SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE addon_purchases SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE search_history SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE leads SET user_id = ${userId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE company_profile SET user_id = ${userId} WHERE user_id = ${oldId}`);

        // (d) Apaga o registro antigo (já sem FKs apontando pra ele)
        await tx.delete(users).where(eq(users.id, oldId));
      });
    } catch (err) {
      console.error(
        "[auth] step4 migration TX falhou oldId=%s newId=%s email=%s:",
        oldId,
        userId,
        email,
        err
      );
      throw err;
    }

    const migrated = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (migrated[0]) return migrated[0];
  }

  // 4) User totalmente novo — INSERT simples
  console.error("[auth] step5 insert novo userId=%s email=%s", userId, email);
  try {
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

    if (!inserted[0]) {
      console.error("[auth] step5 INSERT returnou vazio pra userId=%s — algo inesperado", userId);
      throw new Error("INSERT do user nao retornou nada.");
    }
    return inserted[0];
  } catch (err) {
    console.error("[auth] step5 INSERT falhou userId=%s email=%s:", userId, email, err);
    throw err;
  }
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
