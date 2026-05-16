import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import { readLeads, upsertLeads } from "@/lib/store";
import type { Lead } from "@/lib/types";

const EnrichSchema = z.object({
  id: z.string().optional(),
  lead: z.custom<Lead>((value) => !value || (typeof value === "object" && value !== null)).optional()
});

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const { id, lead: payloadLead } = EnrichSchema.parse(await request.json());
    const lead =
      payloadLead ?? (await readLeads(user.id)).find((item) => item.id === id);
    if (!lead) throw new Error("Lead nao encontrado.");

    const enrichment = await enrichFromWebsite(lead.website);
    const updated = {
      ...lead,
      ...Object.fromEntries(Object.entries(enrichment).filter(([, value]) => Boolean(value))),
      ...diagnoseLead({ ...lead, ...enrichment }),
      updatedAt: new Date().toISOString()
    };

    if (lead.status !== "new") {
      await upsertLeads(user.id, [updated]);
    }
    return NextResponse.json({ lead: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enriquecer lead." },
      { status: 400 }
    );
  }
}
