import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";
import { safeError } from "@/lib/errors";
import { getOrCreateQuota } from "@/lib/quota";
import { PLANS, type PlanId } from "@/lib/plans";

export async function GET() {
  try {
    const user = await getOrSyncUser();
    const quota = await getOrCreateQuota(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        imageUrl: user.imageUrl,
        plan: user.plan
      },
      plan: PLANS[user.plan as PlanId],
      quota
    });
  } catch (error) {
    return safeError(error, "Erro ao carregar perfil.");
  }
}
