import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrSyncUser } from "@/lib/auth";
import { diagnoseLead } from "@/lib/diagnose";
import { enrichFromWebsite } from "@/lib/enrich";
import { LeadInputSchema, safeError } from "@/lib/errors";
import { enforceApiLimit } from "@/lib/rate-limit";
import { readLeads, upsertLeads } from "@/lib/store";

const EnrichSchema = z
  .object({
    id: z.string().min(1).max(200).optional(),
    lead: LeadInputSchema.optional()
  })
  .refine((v) => v.id || v.lead, { message: "É preciso enviar id ou lead." });

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
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
    return safeError(error, "Erro ao enriquecer lead.");
  }
}
