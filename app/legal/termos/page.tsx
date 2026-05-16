import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { LandingNav } from "@/app/_components/LandingNav";

export const metadata = {
  title: "Termos de Uso · Grynd"
};

export default async function TermsPage() {
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
          <h1>Termos de Uso</h1>
        </header>

        <section>
          <h2>1. Aceitação</h2>
          <p>
            Ao criar uma conta e usar a Grynd ("plataforma"), você concorda com estes Termos.
            Se não concordar, não use o serviço.
          </p>
        </section>

        <section>
          <h2>2. Sobre o serviço</h2>
          <p>
            A Grynd é uma ferramenta de prospecção que agrega informações públicas de
            negócios locais (nome, telefone público, endereço, redes sociais, site) e
            organiza esses dados pra facilitar o trabalho comercial do usuário.
          </p>
          <p>
            Não vendemos listas, não usamos bases compradas e não acessamos dados
            privados. Tudo o que entregamos vem de fontes públicas indexadas.
          </p>
        </section>

        <section>
          <h2>3. Conta de usuário</h2>
          <p>
            Você é responsável pela segurança da sua conta. Compartilhar credenciais é
            proibido. Encerraremos contas que detectarmos sendo usadas por terceiros.
          </p>
        </section>

        <section>
          <h2>4. Planos e cobrança</h2>
          <ul>
            <li>
              O plano Free oferece 30 leads/mês, sem cobrança e sem cartão de crédito.
            </li>
            <li>
              Os planos pagos (Pro R$ 59,90/mês e Agência R$ 199,90/mês) são cobrados
              mensalmente via Stripe e renovam automaticamente até cancelamento.
            </li>
            <li>
              O cancelamento é imediato pelo portal de billing. Você mantém o acesso
              ao plano até o fim do período pago.
            </li>
            <li>
              Pacotes extras (+200 leads, R$ 20,00) são pagamentos avulsos. Leads não
              utilizados não expiram enquanto a conta permanecer ativa.
            </li>
            <li>
              Reembolsos seguem o Código de Defesa do Consumidor brasileiro: até 7 dias
              após a primeira compra, sem custo.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Uso aceitável</h2>
          <p>É proibido usar a Grynd para:</p>
          <ul>
            <li>Spam ou disparos em massa não solicitados</li>
            <li>Enviar conteúdo ilegal, ofensivo ou enganoso</li>
            <li>Revender, redistribuir ou expor publicamente os dados da plataforma</li>
            <li>Tentar burlar limites de quota ou contornar verificações de pagamento</li>
            <li>Coletar dados para fins fora do que está descrito no item 2</li>
          </ul>
          <p>
            Violações resultam em suspensão imediata sem reembolso. A Grynd se reserva
            o direito de cooperar com autoridades em casos de uso indevido.
          </p>
        </section>

        <section>
          <h2>6. Disponibilidade</h2>
          <p>
            Nos esforçamos pra manter o serviço no ar 99% do tempo, mas não garantimos
            funcionamento ininterrupto. Manutenções planejadas serão comunicadas com
            antecedência quando possível.
          </p>
        </section>

        <section>
          <h2>7. Limitação de responsabilidade</h2>
          <p>
            A Grynd entrega informação pública agregada. Não somos responsáveis por:
          </p>
          <ul>
            <li>Decisões comerciais tomadas com base nos leads</li>
            <li>Dados desatualizados em fontes públicas que indexamos</li>
            <li>Bloqueio de conta WhatsApp ou outras plataformas decorrente do uso</li>
            <li>Resultados de campanhas de prospecção</li>
          </ul>
        </section>

        <section>
          <h2>8. Alterações</h2>
          <p>
            Esses Termos podem ser atualizados. Mudanças significativas serão
            comunicadas por e-mail com 15 dias de antecedência. O uso continuado após
            alterações implica aceitação.
          </p>
        </section>

        <section>
          <h2>9. Foro</h2>
          <p>
            Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer
            controvérsias decorrentes deste contrato.
          </p>
        </section>

        <section>
          <h2>10. Contato</h2>
          <p>
            Dúvidas: <a href="mailto:contato@grynd.com.br">contato@grynd.com.br</a>
          </p>
        </section>
      </article>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link href="/" className="nav-brand" aria-label="Grynd">
            <img src="/grynd-logo.svg" alt="Grynd" className="nav-logo" />
          </Link>
          <nav className="lp-footer-nav">
            <Link href="/pricing">Planos</Link>
            <Link href="/legal/privacidade">Privacidade</Link>
            <Link href="/sign-in">Entrar</Link>
          </nav>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Grynd</p>
        </div>
      </footer>
    </main>
  );
}
