import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrSyncUser } from "@/lib/auth";
import { safeError } from "@/lib/errors";
import { readProfile, saveProfile } from "@/lib/profile";
import { enforceApiLimit } from "@/lib/rate-limit";

const ProfileSchema = z.object({
  brandName: z.string().min(1).max(60).optional(),
  offer: z.string().max(200).optional(),
  focusRegion: z.string().max(120).optional(),
  tone: z.string().max(120).optional(),
  signature: z.string().max(120).optional()
});

export async function GET() {
  try {
    const user = await getOrSyncUser();
    return NextResponse.json({ profile: await readProfile(user.id) });
  } catch (error) {
    return safeError(error, "Erro ao carregar perfil.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const body = ProfileSchema.parse(await request.json());
    const profile = await saveProfile(user.id, body);
    return NextResponse.json({ profile });
  } catch (error) {
    return safeError(error, "Erro ao salvar perfil.");
  }
}
