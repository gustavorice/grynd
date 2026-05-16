"use client";

import { ArrowRight, Check, Crown, Plus, X } from "lucide-react";
import { useEffect } from "react";

type WelcomeKind = "upgrade-pro" | "upgrade-agency" | "addon";

type Props = {
  kind: WelcomeKind;
  planName?: string;
  searchesIncluded?: number;
  onClose: () => void;
};

const COPY: Record<
  WelcomeKind,
  { eyebrow: string; title: string; subtitle: string; highlights: string[] }
> = {
  "upgrade-pro": {
    eyebrow: "Upgrade confirmado",
    title: "Bem-vindo ao Pro",
    subtitle: "Você desbloqueou tudo que precisa pra prospectar em volume.",
    highlights: [
      "3.500 leads por mês",
      "Export CSV / Sheets",
      "10 AI Insights / mês",
      "Pacotes extras de +200 leads quando quiser"
    ]
  },
  "upgrade-agency": {
    eyebrow: "Upgrade confirmado",
    title: "Bem-vindo à Agência",
    subtitle: "Plano completo, sem limites práticos. Cresça sem se preocupar.",
    highlights: [
      "25.000 leads por mês",
      "WhatsApp Cloud API",
      "API pública",
      "AI Insights ilimitados",
      "Suporte prioritário"
    ]
  },
  addon: {
    eyebrow: "Pacote adicionado",
    title: "+200 leads disponíveis",
    subtitle: "Buscas extras já liberadas na sua conta. Não expiram enquanto estiver ativo.",
    highlights: ["Saldo somado à quota atual", "Não expiram", "Pode comprar mais a qualquer momento"]
  }
};

export function WelcomeModal({ kind, planName, searchesIncluded, onClose }: Props) {
  // ESC fecha
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

  const copy = COPY[kind];
  const showCrown = kind !== "addon";
  const Icon = kind === "addon" ? Plus : Crown;

  return (
    <div className="welcomeOverlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <button
        type="button"
        className="welcomeOverlay-backdrop"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="welcomeModal">
        <div className="welcomeModal-glow" aria-hidden />

        <button
          type="button"
          className="welcomeModal-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="welcomeModal-icon">
          {showCrown ? <Icon size={26} /> : <Icon size={26} />}
        </div>

        <span className="welcomeModal-eyebrow">{copy.eyebrow}</span>
        <h2 id="welcome-title" className="welcomeModal-title">
          {planName && kind !== "addon" ? `Bem-vindo ao ${planName}` : copy.title}
        </h2>
        <p className="welcomeModal-sub">{copy.subtitle}</p>

        <ul className="welcomeModal-features">
          {copy.highlights.map((feature, i) => {
            // Substitui o "3.500 leads" pelo valor real do plano se passado
            const replaced =
              i === 0 && searchesIncluded
                ? feature.replace(/[\d.]+(\s*leads)/, `${searchesIncluded.toLocaleString("pt-BR")}$1`)
                : feature;
            return (
              <li key={feature}>
                <Check size={14} />
                {replaced}
              </li>
            );
          })}
        </ul>

        <button type="button" className="welcomeModal-cta" onClick={onClose}>
          Começar a usar
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
