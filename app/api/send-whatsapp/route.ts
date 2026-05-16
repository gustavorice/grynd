import { NextResponse } from "next/server";
import { z } from "zod";

// Pode invocar scraping de fallback pra hidratar contato — mesmo timeout da busca.
export const maxDuration = 60;
export const runtime = "nodejs";
import { AuthError, getOrSyncUser } from "@/lib/auth";
import { normalizeBrazilPhone } from "@/lib/phone";
import { PLANS, type PlanId } from "@/lib/plans";
import { scrapeGoogleMapsContact } from "@/lib/providers/google-maps-scrape";
import { upsertLead } from "@/lib/store";
import type { Lead } from "@/lib/types";

const SendSchema = z.object({
  lead: z.custom<Lead>((value) => Boolean(value && typeof value === "object")),
  to: z.string().optional(),
  text: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const plan = PLANS[user.plan as PlanId];
    const { lead, to, text } = SendSchema.parse(await request.json());

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const allowCloudApi = plan.canUseWhatsAppCloud && phoneNumberId && token;

    let hydratedLead = lead;
    let recipient = normalizeBrazilPhone(to ?? lead.whatsapp ?? lead.phone);

    if (!recipient && lead.mapsUrl?.includes("google.com/maps")) {
      const contact = await scrapeGoogleMapsContact(lead.mapsUrl);
      hydratedLead = {
        ...lead,
        phone: contact.phone ?? lead.phone,
        website: contact.website ?? lead.website,
        instagram: contact.instagram ?? lead.instagram,
        facebook: contact.facebook ?? lead.facebook,
        updatedAt: new Date().toISOString()
      };
      recipient = normalizeBrazilPhone(contact.phone);
    }

    if (!recipient) {
      throw new Error("Esse lead nao tem telefone/WhatsApp publico para envio.");
    }

    if (allowCloudApi) {
      const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: { preview_url: true, body: text }
          })
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`WhatsApp Cloud API retornou ${response.status}: ${detail}`);
      }

      const savedLead = {
        ...hydratedLead,
        status: "sent" as const,
        updatedAt: new Date().toISOString()
      };
      await upsertLead(user.id, savedLead);
      return NextResponse.json({ mode: "cloud_api", ok: true, lead: savedLead });
    }

    const savedLead = {
      ...hydratedLead,
      status: "sent" as const,
      updatedAt: new Date().toISOString()
    };
    await upsertLead(user.id, savedLead);
    return NextResponse.json({
      mode: "share_link",
      ok: true,
      lead: savedLead,
      url: `https://wa.me/${recipient}?text=${encodeURIComponent(text)}`
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar para WhatsApp." },
      { status: 400 }
    );
  }
}
