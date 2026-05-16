import { NextResponse } from "next/server";
import { AuthError, getOrSyncUser } from "@/lib/auth";
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro." },
      { status: 500 }
    );
  }
}
