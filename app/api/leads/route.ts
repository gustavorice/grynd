import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { deleteLead, readLeads, updateLeadStatus, upsertLead } from "@/lib/store";
import type { Lead } from "@/lib/types";

const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(["new", "saved", "sent", "contacted", "ignored"])
});

const LeadSchema = z.custom<Lead>((value) => Boolean(value && typeof value === "object"));

export async function GET() {
  try {
    const user = await getOrSyncUser();
    return NextResponse.json({ leads: await readLeads(user.id) });
  } catch (error) {
    return errorResponse(error, "Erro ao listar leads.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const lead = LeadSchema.parse(await request.json());
    const saved = await upsertLead(user.id, {
      ...lead,
      status: lead.status === "new" ? "saved" : lead.status
    });
    return NextResponse.json({ lead: saved });
  } catch (error) {
    return errorResponse(error, "Erro ao salvar lead.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrSyncUser();
    const { id, status } = PatchSchema.parse(await request.json());
    const lead = await updateLeadStatus(user.id, id, status);
    return NextResponse.json({ lead });
  } catch (error) {
    return errorResponse(error, "Erro ao atualizar lead.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getOrSyncUser();
    const { id } = z.object({ id: z.string() }).parse(await request.json());
    return NextResponse.json(await deleteLead(user.id, id));
  } catch (error) {
    return errorResponse(error, "Erro ao remover lead.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 }
  );
}
