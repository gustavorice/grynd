"use client";

import { ArrowLeft, HelpCircle, Mail, MessageCircleQuestion, X } from "lucide-react";
import { useEffect, useState } from "react";

type FaqEntry = {
  id: string;
  q: string;
  a: string;
};

const FAQS: FaqEntry[] = [
  {
    id: "leads-vs-buscas",
    q: "Como funciona o limite de leads?",
    a: "Cada busca devolve uma quantidade de leads e cada um conta na sua quota mensal. Free tem 30 leads/mês, Pro 3.500, Agência 25.000. Cache (busca repetida em menos de 8 min) é grátis e não consome."
  },
  {
    id: "rapida-vs-profunda",
    q: "Qual a diferença entre busca rápida e profunda?",
    a: "Busca rápida é direto na base pública (3-5s, retorna leads imediatos). Profunda faz varredura mais ampla com scraping (15-30s, retorna entre 50-150 leads). Ambas contam na quota."
  },
  {
    id: "sem-leads",
    q: "Não estou recebendo leads na busca",
    a: "Tenta variações: 'hamburgueria' vs 'hamburguer', 'loja de roupas' vs 'moda feminina'. Aumenta a região (cidade maior próxima). E use a busca profunda — ela cobre mais."
  },
  {
    id: "addon",
    q: "Posso comprar mais leads?",
    a: "No plano Pro sim — clica em '+200 leads por R$ 20' no painel quando estourar a quota. Leads avulsos não expiram. No Free precisa fazer upgrade."
  },
  {
    id: "cancelar",
    q: "Como cancelo minha assinatura?",
    a: "Clica no badge do plano no topo (Pro/Agência) → abre o portal Stripe → Cancelar. Você mantém acesso até o fim do período pago. Sem multa."
  },
  {
    id: "csv",
    q: "Como exporto pra CSV?",
    a: "No painel de busca, depois de filtrar os leads, clica no botão verde 'Exportar CSV'. Disponível a partir do plano Pro. Abre direto no Excel BR com separador ;."
  },
  {
    id: "whatsapp",
    q: "Como envio o WhatsApp?",
    a: "Seleciona um lead → clica no botão 'WhatsApp'. Abre uma nova aba com mensagem personalizada já preenchida. Free/Pro usam o share link; Agência tem WhatsApp Cloud API."
  },
  {
    id: "porte",
    q: "Como funciona a classificação Pequena/Média/Grande?",
    a: "Combinação de avaliações, presença digital e marca conhecida. Grandes redes são detectadas automaticamente. Boa pra calibrar a mensagem — fala diferente com franquia vs negócio local."
  }
];

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fecha com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activeId) setActiveId(null);
        else setOpen(false);
      }
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeId]);

  const active = FAQS.find((f) => f.id === activeId);

  return (
    <>
      <button
        type="button"
        className="support-trigger"
        aria-label={open ? "Fechar suporte" : "Abrir suporte"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} /> : <MessageCircleQuestion size={20} />}
      </button>

      {open && (
        <div className="support-panel" role="dialog" aria-label="Suporte">
          <header className="support-head">
            {active ? (
              <button
                type="button"
                className="support-back"
                onClick={() => setActiveId(null)}
                aria-label="Voltar"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
            ) : (
              <div className="support-title">
                <HelpCircle size={14} />
                <span>Como podemos ajudar?</span>
              </div>
            )}
            <button
              type="button"
              className="support-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </header>

          <div className="support-body">
            {active ? (
              <article className="support-answer">
                <h4>{active.q}</h4>
                <p>{active.a}</p>
              </article>
            ) : (
              <>
                <p className="support-intro">
                  Escolha uma pergunta abaixo ou fale com a gente direto.
                </p>
                <ul className="support-faq">
                  {FAQS.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => setActiveId(f.id)}>
                        {f.q}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <footer className="support-foot">
            <a href="mailto:contato@grynd.com.br" className="support-mail">
              <Mail size={13} />
              contato@grynd.com.br
            </a>
          </footer>
        </div>
      )}
    </>
  );
}
