"use client";

import { ArrowRight, Check, Crown, Plus, X } from "lucide-react";
import { useEffect } from "react";
import type { PlanId } from "@/lib/plans";

type Props = {
  planId: PlanId;
  searchesIncluded: number;
  onUpgradePro: () => void;
  onUpgradeAgency: () => void;
  onBuyAddon: () => void;
  onClose: () => void;
};

/**
 * Modal de conversão exibido quando a busca retorna 402 (quota esgotada).
 * Variante por plano:
 *  - free   → CTA primário: upgrade Pro. Secundário: conhecer Agência.
 *  - pro    → CTA primário: +200 leads (addon). Secundário: upgrade Agência.
 *  - agency → sem upsell (25k estourou) — orienta falar com suporte.
 */
export function QuotaModal({
  planId,
  searchesIncluded,
  onUpgradePro,
  onUpgradeAgency,
  onBuyAddon,
  onClose
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const included = searchesIncluded.toLocaleString("pt-BR");

  return (
    <div className="welcomeOverlay" role="dialog" aria-modal="true" aria-labelledby="quota-title">
      <button
        type="button"
        className="welcomeOverlay-backdrop"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="welcomeModal">
        <div className="welcomeModal-glow" aria-hidden />

        <button type="button" className="welcomeModal-close" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>

        <div className="welcomeModal-icon">
          {planId === "pro" ? <Plus size={26} /> : <Crown size={26} />}
        </div>

        <span className="welcomeModal-eyebrow">Limite mensal atingido</span>

        {planId === "free" && (
          <>
            <h2 id="quota-title" className="welcomeModal-title">
              Seus {included} leads do mês acabaram
            </h2>
            <p className="welcomeModal-sub">
              Você encontrou leads — bom sinal. O plano Pro libera volume de verdade pra
              transformar busca em cliente.
            </p>
            <ul className="welcomeModal-features">
              <li>
                <Check size={14} />
                3.500 leads por mês
              </li>
              <li>
                <Check size={14} />
                Export CSV / Sheets
              </li>
              <li>
                <Check size={14} />
                Busca profunda com varredura ampla
              </li>
              <li>
                <Check size={14} />
                Pacotes extras de +200 leads quando precisar
              </li>
            </ul>
            <button type="button" className="welcomeModal-cta" onClick={onUpgradePro}>
              Fazer upgrade — R$ 59,90/mês
              <ArrowRight size={15} />
            </button>
            <button type="button" className="welcomeModal-ctaGhost" onClick={onUpgradeAgency}>
              Sou agência (25.000 leads/mês)
            </button>
            <p className="welcomeModal-foot">Sua quota renova automaticamente todo mês.</p>
          </>
        )}

        {planId === "pro" && (
          <>
            <h2 id="quota-title" className="welcomeModal-title">
              Quota mensal esgotada
            </h2>
            <p className="welcomeModal-sub">
              Você usou os {included} leads do Pro este mês. Continue de onde parou com um
              pacote extra — ou suba pro plano Agência.
            </p>
            <ul className="welcomeModal-features">
              <li>
                <Check size={14} />
                +200 leads por R$ 20 (compra única)
              </li>
              <li>
                <Check size={14} />
                Não expiram — carregam pro mês seguinte
              </li>
              <li>
                <Check size={14} />
                Liberados na hora, sem mudar de plano
              </li>
            </ul>
            <button type="button" className="welcomeModal-cta" onClick={onBuyAddon}>
              Comprar +200 leads — R$ 20
              <ArrowRight size={15} />
            </button>
            <button type="button" className="welcomeModal-ctaGhost" onClick={onUpgradeAgency}>
              Upgrade pra Agência (25.000/mês)
            </button>
            <p className="welcomeModal-foot">Sua quota do plano renova todo mês normalmente.</p>
          </>
        )}

        {planId === "agency" && (
          <>
            <h2 id="quota-title" className="welcomeModal-title">
              Você usou os {included} leads do mês
            </h2>
            <p className="welcomeModal-sub">
              Impressionante. Fala com a gente em contato@grynd.com.br pra desenharmos um plano
              sob medida pro seu volume.
            </p>
            <button type="button" className="welcomeModal-cta" onClick={onClose}>
              Entendi
            </button>
          </>
        )}
      </div>
    </div>
  );
}
