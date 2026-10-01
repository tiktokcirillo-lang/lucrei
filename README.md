# Lucrei — etapa 2

Aplicação React/Vite para precificação e projeções, com Firebase, funções Node na
Vercel e integração de assinaturas Stripe. Responsável informado: **Ohr Creative
Hub**. Suporte e privacidade: **ohrcreativehub@gmail.com**.

Esta entrega inclui a etapa 1. Envie **o conteúdo desta pasta** à raiz do GitHub,
incluindo arquivos ocultos. Não envie apenas o ZIP. Não há credenciais no pacote.
Nenhum serviço foi publicado ou ativado por esta entrega.

## Estado da entrega

- 83 testes passaram, incluindo regras Firestore e operações de dados no emulador.
- Lint e build aprovados; auditoria npm sem vulnerabilidades conhecidas no momento
  da verificação. O build mantém avisos de tamanho de arquivos, principalmente HEIC.
- Stripe foi validado com testes locais e respostas simuladas, não com pagamentos
  em uma conta Stripe real. OAuth Google real, cupons reais, layout em dispositivos
  e recuperação de backups em nuvem ainda precisam de homologação.
- Planos, preços e limites serão definidos depois pelo dono. Cobrança e IA ficam
  desativadas por padrão. Não há teste gratuito ou preço presumido.
- Termos e privacidade são **minutas**, com dados da empresa informados. Precisam
  de revisão e complementação antes de ativar a cobrança.

## Rodar localmente

Use Node 24, conforme `.nvmrc`:

```sh
npm ci
npm run lint
npm test
npm run build
```

Copie `.env.example` para `.env.local`, configure o ambiente e execute `npm run dev`
para o front-end. Para executar também as funções `/api`, utilize `vercel dev`.
Não use as credenciais de produção no desenvolvimento.

## Publicar na Vercel a partir do GitHub

1. Configure o projeto Vercel com preset Vite, comando `npm run build` e saída
   `dist`. Use Node 24. As funções estão em `/api`; código compartilhado em `/server`.
2. Cadastre as variáveis de `.env.example` no ambiente correto. Segredos devem ser
   variáveis sensíveis da Vercel; nunca use prefixo `VITE_` para segredos.
3. Configure um Firebase separado para homologação. As credenciais Admin devem
   corresponder ao mesmo projeto do front-end. Permissões precisam permitir
   autenticação administrativa e as operações Firestore usadas pelo servidor.
4. Configure o domínio autorizado no Firebase Authentication. O domínio padrão
   é `<projectId>.firebaseapp.com`; um domínio customizado também exige revisão
   da lista explícita de origens da política CSP em `vercel.json`.
5. Publique `firestore.rules` no projeto correto e inicialize a política abaixo.
6. Configure Stripe, os webhooks e faça os testes de homologação do guia de entrega.

### Política de acesso — obrigatória

As novas regras negam gravações enquanto a política de acesso não existe. Não
publique as regras isoladamente esperando manter gravação liberada.

Com as credenciais Admin carregadas no ambiente e `FIREBASE_PROJECT_ID` definido:

```sh
REQUIRE_SUBSCRIPTION=false node scripts/bootstrap.mjs SEU_PROJECT_ID
```

`false` permite um piloto gratuito para os cadastros; a leitura de cupons ainda
exige um acesso válido no servidor e limites configurados. Quando os planos
estiverem homologados, execute o mesmo comando com `REQUIRE_SUBSCRIPTION=true`.
Usuários sem assinatura podem acessar `/conta`, exportar dados e excluir a conta.
Dados existentes continuam legíveis pelo dono. Escritas dependem da política.

O catálogo, a situação da assinatura, os contadores e a política não podem ser
alterados pelo navegador. Campos antigos inesperados nos documentos podem impedir
novos salvamentos; faça backup e valide cadastros antigos antes de ativar as regras.

Antes do deploy das regras, execute a verificação somente-leitura no projeto que
contém os dados a preservar. Ela não corrige nem apaga documentos:

```sh
FIREBASE_PROJECT_ID=SEU_PROJECT_ID npm run check:data-compat
```

Forneça a autenticação Admin pelo mecanismo seguro do ambiente (Application Default
Credentials ou variável sensível); não cole credenciais no terminal compartilhado
nem no chat. Saída `incompatible: 0` é necessária antes da publicação. Se houver
achados, exporte o Firestore, teste a migração em um projeto separado e só então
publique as regras. Use `COMPATIBILITY_MAX_DOCUMENTS` para ajustar o limite de
segurança da leitura, ciente do custo das leituras Firestore.

## Stripe

Use uma **sandbox separada** para desenvolvimento/homologação. Use chave restrita
com permissões mínimas para Customers, Prices, Subscriptions, Checkout Sessions e
Billing Portal. Confirme as permissões exigidas em homologação antes de produção.
O SDK está fixado pelo lockfile; a API utilizada é `2026-09-30.endive`.

Defina no servidor `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` e
`BILLING_PLANS_JSON`. O catálogo é um objeto com identificadores de plano e campos
`name`, `priceId` e `scans` (inteiro não negativo). Use um Product diferente para
cada plano e Prices recorrentes. Nenhum produto ou preço foi criado nesta entrega.

Checkout sempre usa o Price do servidor. O navegador não define preço, cliente,
cota ou situação de pagamento. Sessões abertas são reutilizadas, e contas com
assinatura existente são encaminhadas ao portal. O retorno do checkout não libera
acesso; o servidor sincroniza a situação vigente da Stripe.

Cadastre obrigatoriamente o webhook `/api/stripe-webhook` com os eventos:

- `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.subscription.paused` e
  `customer.subscription.resumed`;
- `invoice.paid` e `invoice.payment_failed`;
- `checkout.session.completed`, `checkout.session.async_payment_succeeded` e
  `checkout.session.async_payment_failed`.

O webhook valida assinatura e corpo bruto, ignora eventos já processados e consulta
situação atual da Stripe para reduzir efeitos de entrega fora de ordem. O acesso
exige assinatura ativa com última fatura paga, ou trial válido criado na Stripe,
Price conhecido e período vigente. Configure o portal do cliente para cancelamento,
formas de pagamento e apenas os planos do catálogo permitido. Mudanças de planos
precisam ser testadas com a política de prorrateio escolhida pelo dono.

Depois de definir planos, completar/revisar as páginas legais e homologar, configure
`LEGAL_APPROVED=true` e `BILLING_ENABLED=true`. Não ative essas flags mantendo as
minutas. `npm run preflight` lista configurações ausentes sem imprimir segredos.

**Tributos:** Stripe Tax não foi ativado. O responsável deve validar obrigações e
registros antes de configurar cobrança tributária automática. Referência:
https://docs.stripe.com/billing/taxes/collect-taxes

## Cupons, limites e custos

O endpoint aceita apenas uma imagem JPEG comprimida, sem mensagens ou prompts
arbitrários. O prompt é definido no servidor e o retorno é validado. Confirme os
itens antes de importar. O provedor de IA não recebe credenciais Firebase ou Stripe.

Cada tentativa enviada ao provedor consome uma leitura, inclusive em caso de falha;
isso impede repetição ilimitada custosa. Limites: cota mensal do plano, cinco
requisições por minuto por conta e teto global `AI_GLOBAL_MONTHLY_LIMIT`. Zero no
teto global desativa o serviço. As cotas reiniciam no mês civil em **UTC**, não no
aniversário de cobrança. Não há cobrança automática de excedentes. As reservas são
transacionais para respeitar cotas em chamadas simultâneas.

## Exportação e exclusão

A página `/conta` exporta JSON paginado da conta autenticada. Não aceita UID ou
caminho arbitrário fornecido pelo cliente. O limite da interface é de 20 mil registros;
contas maiores recebem orientação para suporte, sem arquivo parcial apresentado
como completo. A exportação não é um snapshot transacional nem substitui backup.

Exclusão requer nova autenticação Google nos últimos cinco minutos e confirmação
explícita. O servidor bloqueia novas gravações, cancela assinaturas imediatamente
sem prorrateio/reembolso automático, remove o cliente Stripe, apaga dados Firestore
recursivamente e remove o usuário Auth. Dados de outras contas ficam intactos.
Registros fiscais/invoices na Stripe podem permanecer sujeitos à política final.

Uma falha pode deixar a conta com exclusão pendente: novas gravações ficam bloqueadas
para impedir recriação de dados. Aguarde até dois minutos e repita a exclusão;
se a autenticação já tiver sido removida, o suporte deve conferir o marcador e a
conclusão no servidor. Configure TTL no campo `expiresAt` da coleção `accounts`
para os marcadores mínimos de exclusão (30 dias), e também de `stripeEvents`
para eventos processados (30 dias). Campos sem `expiresAt` não devem expirar.

## Backups, recuperação e monitoramento

Consulte `OPERACAO.txt`. Os workflows de backup e monitoramento estão incluídos,
mas não serão executados até o dono configurar as variáveis de habilitação,
identidade e destino. Nenhum backup real foi feito nem restaurado nesta entrega.
O backup incluído exporta Firestore; não exporta Firebase Auth, arquivos de Storage,
configurações da Vercel ou dados da Stripe. A recuperação completa depende também
da preservação segura dessas configurações e identidades.

## Testes

`npm test` pula os testes de regras quando o emulador não está disponível. Para
executar a suíte completa, use Java 21 e Firebase CLI 15.32.1:

```sh
firebase emulators:exec --only firestore --project demo-lucrei "npm test"
```

A suíte de regras e operações de dados também pode rodar com `npm run test:rules`;
ela exige `FIRESTORE_EMULATOR_HOST` para não atingir produção. GitHub Actions executa
lint, testes, build, verificação de padrões de segredos e uma etapa própria com
Java/emulador. `npm run check:secrets` é auxiliar, não garantia de ausência de segredo.

As dependências transitivas `@grpc/grpc-js` e `gaxios > uuid` têm overrides explícitos
para correções de segurança. Os testes de Firestore passaram com essas versões.
Reavalie os overrides ao atualizar Firebase. Não execute `npm audit fix --force`
sem revisar mudanças incompatíveis.
