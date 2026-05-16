import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads as leadsTable, type DbLead } from "@/lib/db/schema";
import type { Lead, LeadStatus } from "@/lib/types";

const IGNORED_TTL_DAYS = 90;
const IGNORED_TTL_MS = IGNORED_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function readLeads(userId: string): Promise<Lead[]> {
  await purgeOldIgnored(userId);
  const rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.userId, userId))
    .orderBy(sql`${leadsTable.updatedAt} desc`);
  return rows.map(toLead);
}

export async function upsertLeads(userId: string, incoming: Lead[]): Promise<Lead[]> {
  if (incoming.length === 0) return [];
  await db
    .insert(leadsTable)
    .values(incoming.map((lead) => toRow(userId, lead)))
    .onConflictDoUpdate({
      target: [leadsTable.userId, leadsTable.source, leadsTable.sourceId],
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        niche: sql`excluded.niche`,
        address: sql`excluded.address`,
        city: sql`excluded.city`,
        phone: sql`coalesce(excluded.phone, ${leadsTable.phone})`,
        whatsapp: sql`coalesce(excluded.whatsapp, ${leadsTable.whatsapp})`,
        website: sql`coalesce(excluded.website, ${leadsTable.website})`,
        instagram: sql`coalesce(excluded.instagram, ${leadsTable.instagram})`,
        facebook: sql`coalesce(excluded.facebook, ${leadsTable.facebook})`,
        email: sql`coalesce(excluded.email, ${leadsTable.email})`,
        mapsUrl: sql`coalesce(excluded.maps_url, ${leadsTable.mapsUrl})`,
        rating: sql`coalesce(excluded.rating, ${leadsTable.rating})`,
        reviewCount: sql`coalesce(excluded.review_count, ${leadsTable.reviewCount})`,
        latitude: sql`coalesce(excluded.latitude, ${leadsTable.latitude})`,
        longitude: sql`coalesce(excluded.longitude, ${leadsTable.longitude})`,
        score: sql`excluded.score`,
        companySize: sql`excluded.company_size`,
        diagnosis: sql`excluded.diagnosis`,
        nextAction: sql`excluded.next_action`,
        tags: sql`excluded.tags`,
        raw: sql`coalesce(excluded.raw, ${leadsTable.raw})`,
        updatedAt: new Date()
      }
    });
  return readLeads(userId);
}

export async function upsertLead(userId: string, lead: Lead): Promise<Lead | undefined> {
  const all = await upsertLeads(userId, [lead]);
  return all.find((item) => item.source === lead.source && item.sourceId === lead.sourceId);
}

export async function updateLeadStatus(
  userId: string,
  id: string,
  status: LeadStatus
): Promise<Lead | undefined> {
  const updated = await db
    .update(leadsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(leadsTable.userId, userId), eq(leadsTable.id, id)))
    .returning();
  return updated[0] ? toLead(updated[0]) : undefined;
}

export async function deleteLead(userId: string, id: string): Promise<{ deleted: boolean }> {
  const result = await db
    .delete(leadsTable)
    .where(and(eq(leadsTable.userId, userId), eq(leadsTable.id, id)))
    .returning({ id: leadsTable.id });
  return { deleted: result.length > 0 };
}

async function purgeOldIgnored(userId: string) {
  const cutoff = new Date(Date.now() - IGNORED_TTL_MS);
  await db
    .delete(leadsTable)
    .where(
      and(
        eq(leadsTable.userId, userId),
        eq(leadsTable.status, "ignored"),
        lt(leadsTable.updatedAt, cutoff)
      )
    );
}

function toLead(row: DbLead): Lead {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    name: row.name,
    category: row.category,
    niche: row.niche,
    address: row.address,
    city: row.city,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    email: row.email ?? undefined,
    mapsUrl: row.mapsUrl ?? undefined,
    rating: row.rating ?? undefined,
    reviewCount: row.reviewCount ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    status: row.status,
    score: row.score,
    companySize: row.companySize,
    diagnosis: row.diagnosis,
    nextAction: row.nextAction,
    tags: row.tags,
    raw: row.raw ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toRow(userId: string, lead: Lead) {
  return {
    id: lead.id,
    userId,
    source: lead.source,
    sourceId: lead.sourceId,
    name: lead.name,
    category: lead.category,
    niche: lead.niche,
    address: lead.address,
    city: lead.city,
    phone: lead.phone ?? null,
    whatsapp: lead.whatsapp ?? null,
    website: lead.website ?? null,
    instagram: lead.instagram ?? null,
    facebook: lead.facebook ?? null,
    email: lead.email ?? null,
    mapsUrl: lead.mapsUrl ?? null,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    status: lead.status,
    score: lead.score,
    companySize: lead.companySize,
    diagnosis: lead.diagnosis,
    nextAction: lead.nextAction,
    tags: lead.tags,
    raw: (lead.raw ?? null) as Record<string, unknown> | null
  };
}
