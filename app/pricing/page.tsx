import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { LandingNav } from "@/app/_components/LandingNav";
import { ADDON_200_SEARCHES, PLANS } from "@/lib/plans";

const FEATURE_ROWS: { label: string; values: [string, string, string] }[] = [
  { label: "Leads por mês", values: ["30", "3.500", "25.000"] },
  { label: "Pacotes extras +200 leads", values: ["—", "R$ 20 cada", "incluso"] },
  { label: "Modo busca rápida", values: ["✓", "✓", "✓"] },
  { label: "Modo busca profunda", values: ["✓", "✓", "✓"] },
  { label: "AI Insights por mês", values: ["—", "10", "ilimitado"] },
  { label: "Export CSV / Sheets", values: ["—", "✓", "✓"] },
  { label: "WhatsApp Cloud API", values: ["share link", "share link", "Cloud API"] },
  { label: "API pública", values: ["—", "—", "✓"] },
  { label: "Suporte", values: ["comunidade", "e-mail", "prioritário"] }
];

export default async function PricingPage() {
  const { userId } = await auth();
  return (
    <main className="lp">
      <LandingNav signedIn={Boolean(userId)} />

      <section className="lp-pricing-hero">
        <div className="lp-glow" aria-hidden />
        <span className="lp-pill">
          <span className="lp-pill-dot" />
          Sem cartão pra começar
        </span>
        <h1>Planos simples. Cresce com você.</h1>
        <p>Comece grátis. Faça upgrade quando precisar. Cancele a qualquer momento.</p>
      </section>

      <section className="lp-pricing-wrap">
        <div className="lp-pricing-grid">
          {(["free", "pro", "agency"] as const).map((id) => {
            const plan = PLANS[id];
            const isPro = id === "pro";
            return (
              <div key={id} className={`lp-price${isPro ? " is-featured" : ""}`}>
                {isPro && <div className="lp-price-flag">Mais popular</div>}
                <span className="lp-price-name">{plan.name}</span>
                <div className="lp-price-amount">
                  {plan.priceCents === 0 ? (
                    "Grátis"
                  ) : (
                    <>
                      <span className="lp-price-cents">R$</span>
                      {(plan.priceCents / 100).toFixed(2).replace(".", ",")}
                      <span className="lp-price-period">/mês</span>
                    </>
                  )}
                </div>
                <p className="lp-price-tagline">
                  {id === "free" && "Pra testar o produto e prospectar pontualmente."}
                  {id === "pro" && "Pra quem prospecta toda semana e precisa fechar."}
                  {id === "agency" && "Pra agências e times que vendem em volume."}
                </p>
                <ul className="lp-price-features">
                  <li>
                    <Check size={14} />
                    <span><strong>{plan.searchesPerMonth.toLocaleString("pt-BR")}</strong> leads por mês</span>
                  </li>
                  <li>
                    <Check size={14} />
                    {plan.aiInsightsPerMonth === -1
                      ? "AI insights ilimitados"
                      : plan.aiInsightsPerMonth > 0
                        ? `${plan.aiInsightsPerMonth} AI insights/mês`
                        : "Sem AI insights"}
                  </li>
                  <li>
                    {plan.canExportCsv ? <Check size={14} /> : <Minus size={14} className="lp-off" />}
                    Export CSV / Sheets
                  </li>
                  <li>
                    {plan.canUseWhatsAppCloud ? <Check size={14} /> : <Minus size={14} className="lp-off" />}
                    WhatsApp Cloud API
                  </li>
                  <li>
                    {plan.canUseApi ? <Check size={14} /> : <Minus size={14} className="lp-off" />}
                    API pública
                  </li>
                  {plan.addonAvailable && (
                    <li>
                      <Plus size={14} />
                      Pacotes extras +200 leads
                    </li>
                  )}
                </ul>
                {id === "free" ? (
                  <Link className="lp-price-cta" href={userId ? "/app" : "/sign-up"}>
                    {userId ? "Abrir app" : "Começar grátis"}
                  </Link>
                ) : userId ? (
                  <Link className={`lp-price-cta${isPro ? " is-primary" : ""}`} href="/app?upgrade=true">
                    Fazer upgrade
                  </Link>
                ) : (
                  <Link className={`lp-price-cta${isPro ? " is-primary" : ""}`} href="/sign-up">
                    Criar conta e assinar
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="lp-addon">
          <div>
            <h3>Pacote extra · +200 leads</h3>
            <p>
              Estourou a quota do Pro no meio do mês? Compra um pacote por
              <strong> R$ {ADDON_200_SEARCHES.priceCents / 100}</strong> e segue. Leads não usados
              não expiram.
            </p>
          </div>
          <div className="lp-addon-amount">
            R$ {(ADDON_200_SEARCHES.priceCents / 100).toFixed(2).replace(".", ",")}
            <small>pagamento único</small>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">Comparação</span>
          <h2 className="lp-section-title">Tudo lado a lado.</h2>
        </div>
        <table className="lp-compare">
          <thead>
            <tr>
              <th></th>
              <th>Free</th>
              <th>Pro</th>
              <th>Agência</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.values[0]}</td>
                <td>{row.values[1]}</td>
                <td>{row.values[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="faq" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">FAQ</span>
          <h2 className="lp-section-title">Perguntas comuns.</h2>
        </div>
        <div className="lp-faq">
          <details>
            <summary>Posso mudar de plano depois?</summary>
            <p>Sim. Upgrades aplicam imediatamente; downgrades no fim do período pago.</p>
          </details>
          <details>
            <summary>Tem desconto anual?</summary>
            <p>Ainda não. Estamos focando em mensal pra dar previsibilidade. Pra plano customizado, fala com a gente.</p>
          </details>
          <details>
            <summary>Posso usar pra agência atendendo vários clientes?</summary>
            <p>O plano Agência é desenhado pra isso: 25.000 leads/mês, AI ilimitado, API e WhatsApp Cloud verificada.</p>
          </details>
          <details>
            <summary>Como funciona o WhatsApp Cloud API?</summary>
            <p>É a API oficial da Meta. Permite envio em massa com templates aprovados. Exige verificação de negócio.</p>
          </details>
        </div>
      </section>

      <section className="lp-final">
        <h2>Pronto pra começar?</h2>
        <p>30 leads grátis no primeiro mês. Sem cartão.</p>
        <Link className="lp-cta-primary" href={userId ? "/app" : "/sign-up"}>
          {userId ? "Abrir aplicativo" : "Criar conta grátis"}
          <ArrowRight size={15} />
        </Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link href="/" className="nav-brand" aria-label="Grynd">
            <img src="/grynd-logo.png" alt="Grynd" className="nav-logo" />
          </Link>
          <nav className="lp-footer-nav">
            <Link href="/#features">Features</Link>
            <Link href="/pricing">Planos</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/legal/termos">Termos</Link>
            <Link href="/legal/privacidade">Privacidade</Link>
            <Link href="/sign-in">Entrar</Link>
          </nav>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Grynd</p>
        </div>
      </footer>
    </main>
  );
}
