import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { companyProfile } from "@/lib/db/schema";

export type CompanyProfile = {
  brandName: string;
  offer: string;
  focusRegion: string;
  tone: string;
  signature?: string;
};

const DEFAULT_PROFILE: CompanyProfile = {
  brandName: "Grynd",
  offer: "Sites, automacoes e presenca digital para negocios locais",
  focusRegion: "Rio Claro e cidades proximas",
  tone: "Curto, consultivo e direto",
  signature: ""
};

export async function readProfile(userId: string): Promise<CompanyProfile> {
  const row = (
    await db.select().from(companyProfile).where(eq(companyProfile.userId, userId)).limit(1)
  )[0];
  if (!row) return DEFAULT_PROFILE;
  return {
    brandName: row.brandName,
    offer: row.offer,
    focusRegion: row.focusRegion,
    tone: row.tone,
    signature: row.signature
  };
}

export async function saveProfile(
  userId: string,
  patch: Partial<CompanyProfile>
): Promise<CompanyProfile> {
  const merged = { ...DEFAULT_PROFILE, ...(await readProfile(userId)), ...patch };
  await db
    .insert(companyProfile)
    .values({
      userId,
      brandName: merged.brandName,
      offer: merged.offer,
      focusRegion: merged.focusRegion,
      tone: merged.tone,
      signature: merged.signature ?? ""
    })
    .onConflictDoUpdate({
      target: companyProfile.userId,
      set: {
        brandName: merged.brandName,
        offer: merged.offer,
        focusRegion: merged.focusRegion,
        tone: merged.tone,
        signature: merged.signature ?? "",
        updatedAt: new Date()
      }
    });
  return merged;
}
