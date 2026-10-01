const CONTACT = "ohrcreativehub@gmail.com";
export default function Legal({ kind }) {
  const privacy = kind === "privacy";
  return (
    <main className="max-w-3xl mx-auto p-6 text-slate-200 space-y-5">
      <a href="/conta" className="text-emerald-400 underline">
        Voltar à conta
      </a>
      <h1 className="text-3xl font-bold">
        {privacy ? "Privacidade" : "Termos de uso"} — Lucrei
      </h1>
      <p className="border border-amber-600 bg-amber-950 p-4 rounded">
        Minuta para revisão da Ohr Creative Hub. Antes de publicar, completar
        identificação legal, endereço, bases de tratamento, retenção e condições
        comerciais. Esta versão não habilita cobranças.
      </p>
      <p>
        Responsável informado: Ohr Creative Hub. Contato de suporte e
        privacidade:{" "}
        <a className="underline" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        .
      </p>
      {privacy ? (
        <>
          <h2 className="text-xl font-semibold">Dados e finalidade</h2>
          <p>
            O login utiliza identificação do Google, nome, e-mail e foto.
            Guardamos cadastros do negócio, ingredientes, produtos e uso do
            serviço para autenticar a conta, calcular projeções e aplicar
            limites. Firebase fornece autenticação e banco de dados; Vercel
            hospeda o app; Stripe processa assinaturas. O código-fonte é mantido
            no GitHub.
          </p>
          <h2 className="text-xl font-semibold">
            Cupons e inteligência artificial
          </h2>
          <p>
            Ao solicitar a leitura, a imagem é enviada ao serviço Anthropic para
            extrair itens. O app não salva a imagem no banco; somente itens
            confirmados são cadastrados. Evite enviar documentos com dados
            pessoais desnecessários. As condições e retenção de cada fornecedor
            devem ser verificadas pela empresa antes de ativar o recurso.
          </p>
          <h2 className="text-xl font-semibold">Acesso e exclusão</h2>
          <p>
            Na página Conta, você pode baixar seus dados e pedir exclusão
            mediante nova confirmação de identidade. A exclusão cancela
            assinaturas e remove o cadastro e seus dados operacionais. Um
            marcador técnico mínimo impede requisições antigas de recriarem
            dados. Registros de faturamento e backups podem exigir tratamento
            separado; os prazos e justificativas devem constar da versão final
            desta política.
          </p>
          <p>
            Para solicitar acesso, correção, informações sobre compartilhamento
            ou exercer outros direitos, use o contato acima. Solicitações devem
            ser analisadas conforme as condições legais aplicáveis. Consulte
            também as{" "}
            <a
              className="underline"
              href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares"
            >
              orientações da ANPD
            </a>
            .
          </p>
          <h2 className="text-xl font-semibold">
            Armazenamento local e operação
          </h2>
          <p>
            O navegador mantém a sessão e o histórico local de exportações por
            conta. O app instalável armazena recursos para carregamento. Logs
            técnicos do servidor registram códigos de erro e identificadores de
            requisição, sem incluir imagens de cupons ou tokens. Regiões,
            transferências internacionais, bases legais e prazos de retenção
            precisam ser confirmados na configuração final.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold">Uso do serviço</h2>
          <p>
            O Lucrei ajuda a calcular preços e projeções usando os dados
            informados. Os resultados são estimativas; não representam vendas
            realizadas nem garantem lucro. Confira custos, volumes, impostos e
            os itens extraídos de cupons antes de decidir ou salvar.
          </p>
          <h2 className="text-xl font-semibold">Planos e cobrança</h2>
          <p>
            Planos, preços, periodicidade, limites, condições de teste e
            reembolso ainda serão definidos. Quando habilitada, a assinatura
            será contratada pelo checkout Stripe. A situação do pagamento será
            confirmada no servidor antes da liberação. Leituras são contadas por
            tentativa enviada e o limite reinicia no mês civil em UTC; não há
            cobrança automática por excedente.
          </p>
          <h2 className="text-xl font-semibold">Cancelamento e exclusão</h2>
          <p>
            O portal Stripe permite gerenciar a assinatura conforme as condições
            apresentadas na contratação. Excluir a conta cancela imediatamente
            as assinaturas e remove os dados operacionais. A exclusão não emite
            reembolso automático; pedidos e direitos legais devem ser tratados
            pelo suporte. Exporte os dados que deseja manter antes de excluir.
          </p>
          <h2 className="text-xl font-semibold">Responsabilidades</h2>
          <p>
            Utilize apenas dados e imagens que tenha autorização para enviar.
            Não compartilhe a conta, tente acessar dados de terceiros nem
            contorne os limites de uso. Falhas e dúvidas podem ser comunicadas
            ao suporte. Condições de disponibilidade, manutenção, encerramento e
            identificação legal precisam ser concluídas antes do lançamento.
          </p>
        </>
      )}
    </main>
  );
}
