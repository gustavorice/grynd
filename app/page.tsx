import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  Download,
  Filter,
  Gauge,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Target
} from "lucide-react";
import { LandingNav } from "@/app/_components/LandingNav";
import { PLANS } from "@/lib/plans";

export default async function LandingPage() {
  const { userId } = await auth();
  const ctaHref = userId ? "/app" : "/sign-up";
  const ctaLabel = userId ? "Abrir aplicativo" : "Começar grátis";

  return (
    <main className="lp">
      <LandingNav signedIn={Boolean(userId)} />

      <section className="lp-hero">
        <div className="lp-grid-bg" aria-hidden />
        <div className="lp-glow" aria-hidden />

        <div className="lp-hero-inner">
          <span className="lp-pill">
            <span className="lp-pill-dot" />
            Brasil · prospecção local
          </span>
          <h1 className="lp-hero-title">Leads do seu nicho.<br />Sem caçar.</h1>
          <p className="lp-hero-sub">
            Encontre negócios locais com WhatsApp, telefone e redes sociais validados.
            Multi-fonte, rápido, focado em São Paulo e o resto do Brasil.
          </p>
          <div className="lp-hero-ctas">
            <Link className="lp-cta-primary" href={ctaHref}>
              {ctaLabel}
              <ArrowRight size={15} />
            </Link>
            <Link className="lp-cta-secondary" href="/pricing">
              Ver planos
            </Link>
          </div>
          <p className="lp-hero-trust">30 leads no primeiro mês · sem cartão · cancele a qualquer momento</p>
        </div>

        <div className="lp-showcase">
          <ProductMockup />
        </div>
      </section>

      <section className="lp-stats">
        <Stat value="180k+" label="Negócios mapeados" />
        <Stat value="14k" label="WhatsApps detectados" />
        <Stat value="22k" label="Sites ativos" />
        <Stat value="3-5s" label="Por busca rápida" />
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">Features</span>
          <h2 className="lp-section-title">Tudo que prospecção local precisa.</h2>
          <p className="lp-section-sub">
            Multi-fonte, deduplicação, enriquecimento e abordagem — num só lugar.
          </p>
        </div>

        <div className="lp-features">
          <Feature
            icon={<Compass size={18} />}
            title="Cobertura ampla"
            text="Varredura paralela em múltiplas bases públicas, com deduplicação por nome e coordenadas. Sem lead repetido."
          />
          <Feature
            icon={<MessageCircle size={18} />}
            title="WhatsApp em um clique"
            text="Detecta número público, valida DDD ANATEL e abre conversa com mensagem personalizada."
          />
          <Feature
            icon={<Filter size={18} />}
            title="Filtros que importam"
            text="Por porte (pequena, média, grande), por canal disponível, por status do funil."
          />
          <Feature
            icon={<Target size={18} />}
            title="Identificação de porte"
            text="Reconhece rede, franquia ou negócio local automaticamente — aborda diferente pra cada um."
          />
          <Feature
            icon={<Globe2 size={18} />}
            title="Enriquecimento web"
            text="Acha Instagram, Facebook e e-mail no site do lead. Lê JSON-LD, contato e sobre."
          />
          <Feature
            icon={<Download size={18} />}
            title="Export CSV nativo"
            text="Tudo em UTF-8 com BOM pro Excel abrir sem cagar acento. Pronto pra importar em qualquer CRM."
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">Como funciona</span>
          <h2 className="lp-section-title">Três passos. Cinco segundos.</h2>
        </div>
        <div className="lp-steps">
          <Step
            num="01"
            title="Diga o nicho e a cidade"
            text='"Sorveteria em Rio Claro". Pronto. Sinônimos, variações e traduções de termo já estão cobertos.'
          />
          <Step
            num="02"
            title="Receba leads enriquecidos"
            text="Telefone, WhatsApp, Instagram, site, avaliações. Score automático e porte já identificado."
          />
          <Step
            num="03"
            title="Aborde pelo WhatsApp"
            text="Mensagem personalizada por porte e nicho. Um clique abre o WhatsApp com o texto pronto."
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">Planos</span>
          <h2 className="lp-section-title">Comece grátis. Cresce quando precisar.</h2>
        </div>
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
                  {id === "free" && "Pra testar e prospectar pontualmente."}
                  {id === "pro" && "Pra quem prospecta toda semana."}
                  {id === "agency" && "Pra agências que vendem em volume."}
                </p>
                <ul className="lp-price-features">
                  <li>
                    <Check size={14} />
                    {plan.searchesPerMonth.toLocaleString("pt-BR")} leads/mês
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
                    <Check size={14} />
                    {plan.canExportCsv ? "Export CSV / Sheets" : "WhatsApp share link"}
                  </li>
                  <li>
                    <Check size={14} />
                    {plan.canUseWhatsAppCloud ? "WhatsApp Cloud API" : "WhatsApp share link"}
                  </li>
                </ul>
                <Link className={`lp-price-cta${isPro ? " is-primary" : ""}`} href="/pricing">
                  {plan.priceCents === 0 ? "Começar grátis" : "Ver detalhes"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section id="faq" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-eyebrow">FAQ</span>
          <h2 className="lp-section-title">Perguntas comuns.</h2>
        </div>
        <div className="lp-faq">
          <details>
            <summary>O que acontece se eu estourar a quota?</summary>
            <p>
              No Free, você espera o próximo mês ou faz upgrade. No Pro, compra pacotes extras
              de +200 leads por R$ 20 cada — leads avulsos não expiram.
            </p>
          </details>
          <details>
            <summary>Posso cancelar a qualquer momento?</summary>
            <p>
              Sim. Cancelamento imediato pelo portal de billing. Você mantém o plano até o fim
              do período pago e depois volta pro Free automaticamente.
            </p>
          </details>
          <details>
            <summary>De onde vêm os dados?</summary>
            <p>
              100% de fontes públicas. Não usamos listas compradas nem extraímos de redes
              fechadas — só agregamos e enriquecemos o que já é público.
            </p>
          </details>
          <details>
            <summary>Vocês entregam o WhatsApp do lead?</summary>
            <p>
              Quando o número está público, sim. O sistema normaliza pra padrão brasileiro e
              valida o DDD. Quando não temos, mostramos claramente.
            </p>
          </details>
        </div>
      </section>

      <section className="lp-final">
        <h2>Comece a prospectar agora.</h2>
        <p>30 leads grátis no primeiro mês. Sem cartão.</p>
        <Link className="lp-cta-primary" href={ctaHref}>
          {ctaLabel}
          <ArrowRight size={15} />
        </Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link href="/" className="nav-brand">
            <span className="nav-mark">G</span>
            <span>Grynd</span>
          </Link>
          <nav className="lp-footer-nav">
            <Link href="/#features">Features</Link>
            <Link href="/pricing">Planos</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/sign-in">Entrar</Link>
          </nav>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Grynd</p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="lp-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="lp-feature">
      <div className="lp-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Step({ num, title, text }: { num: string; title: string; text: string }) {
  return (
    <div className="lp-step">
      <div className="lp-step-num">{num}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="lp-mock">
      <div className="lp-mock-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="lp-mock-body">
        <div className="lp-mock-side">
          <h4>Busca</h4>
          <div className="lp-mock-input">Rio Claro, SP</div>
          <div className="lp-mock-input">sorveteria</div>
          <div className="lp-mock-btn">Buscar 120 leads</div>
        </div>

        <div className="lp-mock-list">
          {MOCK_LEADS.map((lead, i) => (
            <div key={lead.name} className={`lp-mock-row${i === 1 ? " is-active" : ""}`}>
              <div>
                <strong>{lead.name}</strong>
                <span>{lead.category}</span>
              </div>
              <span className="lp-mock-tag">{lead.tag}</span>
            </div>
          ))}
        </div>

        <div className="lp-mock-detail">
          <h5>Sorveteria Vila Bela</h5>
          <p>Sorveteria · Vila Bela</p>
          <div className="lp-mock-detail-row">
            <Phone size={14} />
            <span>(19) 99987-2210</span>
          </div>
          <div className="lp-mock-detail-row">
            <MessageCircle size={14} />
            <span>WhatsApp disponível</span>
          </div>
          <div className="lp-mock-detail-row">
            <Globe2 size={14} />
            <span>sorveteriavilabela.com.br</span>
          </div>
          <div className="lp-mock-detail-row">
            <Mail size={14} />
            <span>contato@sorveteriavilabela.com.br</span>
          </div>
          <div className="lp-mock-detail-row">
            <BarChart3 size={14} />
            <span>Score 78 · Média</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_LEADS: { name: string; category: string; tag: string }[] = [
  { name: "Gelato Borelli", category: "Sorveteria · Centro", tag: "Média" },
  { name: "Sorveteria Vila Bela", category: "Sorveteria · Vila Bela", tag: "Pequena" },
  { name: "Açaí da Praça", category: "Açaí · Boa Vista", tag: "Pequena" },
  { name: "Mil Sabores", category: "Sorveteria · São Benedito", tag: "Média" },
  { name: "Frooty Rio Claro", category: "Açaí · Centro", tag: "Grande" },
  { name: "Tutti Frutti", category: "Sorveteria · Jardim", tag: "Pequena" }
];
