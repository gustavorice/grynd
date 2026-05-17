import { NextResponse } from "next/server";
import { z } from "zod";

// Pode invocar scraping de fallback pra hidratar contato — mesmo timeout da busca.
export const maxDuration = 60;
export const runtime = "nodejs";
import { getOrSyncUser } from "@/lib/auth";
import { LeadInputSchema, safeError } from "@/lib/errors";
import { normalizeBrazilPhone } from "@/lib/phone";
import { PLANS, type PlanId } from "@/lib/plans";
import { scrapeGoogleMapsContact } from "@/lib/providers/google-maps-scrape";
import { enforceApiLimit } from "@/lib/rate-limit";
import { upsertLead } from "@/lib/store";

const SendSchema = z.object({
  lead: LeadInputSchema,
  to: z.string().max(40).optional(),
  text: z.string().min(1).max(4000)
});

export async function POST(request: Request) {
  try {
    const user = await getOrSyncUser();
    const limited = await enforceApiLimit(user.id);
    if (limited) return limited;
    const plan = PLANS[user.plan as PlanId];
    const { lead, to, text } = SendSchema.parse(await request.json());

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const allowCloudApi = plan.canUseWhatsAppCloud && phoneNumberId && token;

    let hydratedLead = lead;
    // Numeros candidatos vindos do proprio lead (whatsapp, phone). O `to` opcional
    // SÓ é aceito se bater com um desses numeros — impede spam pra qualquer número
    // arbitrario passando pelo token do WhatsApp Cloud API.
    const leadCandidates = new Set(
      [lead.whatsapp, lead.phone]
        .map((n) => normalizeBrazilPhone(n))
        .filter((n): n is string => Boolean(n))
    );

    let recipient: string | null = null;
    if (to) {
      const normalizedTo = normalizeBrazilPhone(to);
      if (normalizedTo && leadCandidates.has(normalizedTo)) {
        recipient = normalizedTo;
      } else {
        throw new Error("Numero de destino nao bate com o telefone do lead.");
      }
    } else {
      recipient = normalizeBrazilPhone(lead.whatsapp ?? lead.phone) ?? null;
    }

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
      recipient = normalizeBrazilPhone(contact.phone) ?? null;
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
    return safeError(error, "Erro ao enviar para WhatsApp.");
  }
}
