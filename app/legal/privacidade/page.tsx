import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { LandingNav } from "@/app/_components/LandingNav";

export const metadata = {
  title: "Política de Privacidade · Grynd"
};

export default async function PrivacyPage() {
  const { userId } = await auth();
  return (
    <main className="lp">
      <LandingNav signedIn={Boolean(userId)} />

      <article className="legal">
        <header>
          <span className="lp-pill">
            <span className="lp-pill-dot" />
            Atualizado em 16/05/2026
          </span>
          <h1>Política de Privacidade</h1>
          <p className="legal-lead">
            Conforme a LGPD (Lei 13.709/2018), descrevemos abaixo como tratamos
            dados pessoais.
          </p>
        </header>

        <section>
          <h2>1. Quem somos</h2>
          <p>
            Grynd é uma plataforma de prospecção operada por Gustavo Rice (CPF a ser
            adicionado), com sede em Rio Claro/SP.
          </p>
          <p>
            Encarregado de Dados (DPO): <a href="mailto:contato@grynd.com.br">contato@grynd.com.br</a>
          </p>
        </section>

        <section>
          <h2>2. Quais dados coletamos</h2>
          <p><strong>Do usuário (você, cliente):</strong></p>
          <ul>
            <li>E-mail, nome e foto (via Clerk no momento do cadastro)</li>
            <li>Dados de pagamento (processados diretamente pela Stripe — nunca armazenamos cartão)</li>
            <li>Histórico de buscas e leads salvos na sua conta</li>
            <li>Endereço IP e logs de uso pra segurança e prevenção de fraude</li>
          </ul>
          <p><strong>Dos leads (negócios pesquisados):</strong></p>
          <ul>
            <li>Informações públicas: nome, endereço, telefone, redes sociais, site, avaliações</li>
            <li>Originadas de fontes públicas indexadas</li>
            <li>Não coletamos dados de pessoas físicas — apenas estabelecimentos comerciais</li>
          </ul>
        </section>

        <section>
          <h2>3. Por que coletamos (bases legais)</h2>
          <ul>
            <li>
              <strong>Execução de contrato</strong>: pra operar sua conta, processar pagamentos
              e entregar o serviço contratado
            </li>
            <li>
              <strong>Legítimo interesse</strong>: pra prevenir fraude, melhorar o produto e
              oferecer suporte
            </li>
            <li>
              <strong>Consentimento</strong>: pra comunicação de marketing (apenas se você optar)
            </li>
            <li>
              <strong>Obrigação legal</strong>: pra emitir notas fiscais e responder a autoridades
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Com quem compartilhamos</h2>
          <p>
            Operadores subcontratados (todos com cláusulas de proteção de dados):
          </p>
          <ul>
            <li><strong>Clerk</strong> — autenticação e gestão de usuários</li>
            <li><strong>Stripe</strong> — processamento de pagamentos (PCI-DSS Level 1)</li>
            <li><strong>Neon</strong> — banco de dados (Postgres gerenciado, dados em região sa-east-1)</li>
            <li><strong>Vercel</strong> — hospedagem e CDN</li>
            <li><strong>Upstash</strong> — cache e rate limit</li>
          </ul>
          <p>
            Não vendemos dados pra terceiros. Não compartilhamos com finalidades de
            marketing externo.
          </p>
        </section>

        <section>
          <h2>5. Por quanto tempo guardamos</h2>
          <ul>
            <li>Dados de conta: enquanto a conta estiver ativa</li>
            <li>Leads salvos: enquanto a conta estiver ativa</li>
            <li>Leads ignorados: 90 dias após o ignore, depois apagados automaticamente</li>
            <li>Histórico de busca: 12 meses</li>
            <li>Logs de segurança: 6 meses</li>
            <li>Dados fiscais: 5 anos (obrigação legal)</li>
          </ul>
          <p>
            Após cancelamento da conta, dados pessoais são apagados em até 30 dias —
            exceto dados fiscais.
          </p>
        </section>

        <section>
          <h2>6. Seus direitos (LGPD)</h2>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul>
            <li>Acesso aos dados que temos sobre você</li>
            <li>Correção de dados incompletos ou inexatos</li>
            <li>Eliminação dos dados (com ressalva pros dados fiscais)</li>
            <li>Portabilidade pra outro serviço</li>
            <li>Revogação de consentimento</li>
            <li>Informação sobre compartilhamento</li>
          </ul>
          <p>
            Pra exercer: envie e-mail pra{" "}
            <a href="mailto:contato@grynd.com.br">contato@grynd.com.br</a>. Respondemos
            em até 15 dias.
          </p>
        </section>

        <section>
          <h2>7. Cookies</h2>
          <p>
            Usamos cookies essenciais (sessão de login, preferências) e analytics
            (estatísticas anônimas de uso). Não usamos cookies de publicidade nem
            compartilhamos com redes de ads.
          </p>
        </section>

        <section>
          <h2>8. Segurança</h2>
          <p>
            HTTPS em todas as conexões. Senhas hashed pela Clerk (bcrypt). Dados em
            repouso criptografados (Neon). Tokens de pagamento processados pela Stripe
            (PCI-DSS). Logs de acesso monitorados.
          </p>
          <p>
            Apesar disso, nenhum sistema é 100% imune. Em caso de incidente, te
            notificamos em até 72h conforme exige a LGPD.
          </p>
        </section>

        <section>
          <h2>9. Crianças</h2>
          <p>
            Grynd não é destinado a menores de 18 anos. Não coletamos dados de
            menores conscientemente.
          </p>
        </section>

        <section>
          <h2>10. Alterações</h2>
          <p>
            Esta política pode ser atualizada. Alterações relevantes serão comunicadas
            por e-mail com 15 dias de antecedência.
          </p>
        </section>

        <section>
          <h2>11. Contato e reclamações</h2>
          <p>
            <strong>E-mail</strong>: <a href="mailto:contato@grynd.com.br">contato@grynd.com.br</a>
          </p>
          <p>
            Você também pode reclamar diretamente à <strong>ANPD</strong> (Autoridade
            Nacional de Proteção de Dados) em{" "}
            <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">
              gov.br/anpd
            </a>
            .
          </p>
        </section>
      </article>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link href="/" className="nav-brand">
            <span className="nav-mark">G</span>
            <span>Grynd</span>
          </Link>
          <nav className="lp-footer-nav">
            <Link href="/pricing">Planos</Link>
            <Link href="/legal/termos">Termos</Link>
            <Link href="/sign-in">Entrar</Link>
          </nav>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Grynd</p>
        </div>
      </footer>
    </main>
  );
}
