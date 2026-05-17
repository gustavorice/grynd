import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrSyncUser } from "@/lib/auth";
import { LeadInputSchema, safeError } from "@/lib/errors";
import { enforceApiLimit } from "@/lib/rate-limit";
import { deleteLead, readLeads, updateLeadStatus, upsertLead } from "@/lib/store";

const PatchSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(["new", "saved", "sent", "contacted", "ignored"])
});

const DeleteSchema = z.object({ id: z.string().min(1).max(200) });

export async function GET() {
  try {
    const user = await getOrSyncUser();
    return NextResponse.json({ leads: await readLeads(user.id) });
  } catch (error) {
    return safeError(error, "Erro ao listar leads.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const lead = LeadInputSchema.parse(await request.json());
    const saved = await upsertLead(user.id, {
      ...lead,
      status: lead.status === "new" ? "saved" : lead.status
    });
    return NextResponse.json({ lead: saved });
  } catch (error) {
    return safeError(error, "Erro ao salvar lead.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const { id, status } = PatchSchema.parse(await request.json());
    const lead = await updateLeadStatus(user.id, id, status);
    return NextResponse.json({ lead });
  } catch (error) {
    return safeError(error, "Erro ao atualizar lead.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const { id } = DeleteSchema.parse(await request.json());
    return NextResponse.json(await deleteLead(user.id, id));
  } catch (error) {
    return safeError(error, "Erro ao remover lead.");
  }
}
