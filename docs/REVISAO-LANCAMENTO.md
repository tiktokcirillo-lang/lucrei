# Revisão de preparação para lançamento

Data da revisão: 1 de outubro de 2026  
Responsável informado: Ohr Creative Hub  
Contato informado: ohrcreativehub@gmail.com

Este documento separa implementação, verificação reproduzida e pendências externas.
Não autoriza produção, cobrança real ou exclusão de dados.

## Corrigido nesta revisão

- Stripe bloqueia chaves `sk_live_` e `rk_live_` enquanto `STRIPE_LIVE_MODE` não
  estiver explicitamente habilitado.
- Catálogo recusa nome vazio, Price ID duplicado e limites inválidos.
- Checkout recupera sessão removida, repara com segurança o mapeamento de clientes
  legados e não envia parâmetro não suportado pela API Stripe.
- Portal também exige que o cliente Stripe pertença à conta autenticada.
- Troca de usuário não reutiliza temporariamente estado da conta anterior; dados do
  portfólio são isolados pelo UID carregado.
- Exclusão local remove o histórico pelo UID capturado antes de a sessão desaparecer.
- Dashboard recalcula o portfólio atual, ignora resultados salvos desatualizados,
  desconta custo fixo uma vez, usa margem operacional consolidada e ordena produtos
  pela contribuição mensal total. Produtos incompletos ficam fora da projeção e são
  identificados como problema de qualidade de dados.
- Foi adicionado `npm run check:data-compat`, scanner somente-leitura que compara os
  documentos existentes com os formatos aceitos pelas novas regras Firestore.

## Verificado localmente

- Testes unitários de cálculos, cobrança, webhook simulado, autorização de servidor,
  cotas e validadores de compatibilidade.
- Lint, build de produção e verificação auxiliar de padrões de segredo.
- Auditoria npm consultada novamente: zero vulnerabilidades conhecidas.
- Preflight sem configuração: falha de forma segura e confirma cobrança, minutas e
  leitura de cupons desativadas.
- Tela pública de login e páginas legais renderizadas em viewport de 390 px, sem
  overflow horizontal ou overlay de erro, usando configuração Firebase fictícia.

Os testes Firestore que dependem do emulador não foram reproduzidos nesta máquina,
pois Java e Firebase CLI não estão instalados. O workflow CI inclui Java 21 e Firebase
CLI 15.32.1 e deve executá-los na branch antes do merge. A renderização local não
homologa login Google real nem fluxos autenticados.

## Configuração segura de homologação

Use uma branch/URL estável de Preview na Vercel e um projeto Firebase exclusivo de
homologação. Separe totalmente credenciais e dados de produção.

| Grupo | Ambiente Preview/homologação | Observação |
| --- | --- | --- |
| `VITE_FIREBASE_*` | Configuração pública do Firebase de homologação | Exposta ao navegador por desenho; nunca contém chave Admin |
| `FIREBASE_PROJECT_ID` | ID do mesmo Firebase de homologação | Servidor |
| `FIREBASE_ADMIN_CREDENTIALS_JSON` | Variável sensível | Conceder apenas permissões necessárias; não colar no chat |
| `APP_URL` | URL HTTPS estável da homologação | Precisa coincidir com retornos Stripe e domínios autorizados |
| `STRIPE_SECRET_KEY` | Chave restrita de sandbox | Nunca usar chave live em Preview |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint sandbox | Endpoint `/api/stripe-webhook` |
| `STRIPE_LIVE_MODE` | `false` | Trava adicional contra chave live |
| `BILLING_ENABLED` | `false` | Manter assim até planos e testes aprovados |
| `LEGAL_APPROVED` | `false` | Manter assim enquanto as páginas forem minutas |
| `BILLING_PLANS_JSON` | `{}` por enquanto | Não inventar preços, planos, limites ou trial |
| `AI_GLOBAL_MONTHLY_LIMIT` | `0` | Mantém leitura de cupons desativada |

Escopo recomendado na Vercel: Firebase e Stripe sandbox somente em Preview e
Development; produção deve receber valores próprios apenas numa ativação posterior.
Depois de qualquer ajuste, confira somente os nomes das variáveis e rode
`npm run preflight`; não registre valores secretos em logs.

## Roteiro de homologação ainda pendente

1. Executar `npm run check:data-compat` contra os dados que serão preservados e
   obter `incompatible: 0`; depois criar backup Firestore.
2. Publicar regras e `accessPolicy/public` apenas no Firebase de homologação.
3. Validar Google OAuth, onboarding, criação/edição/exclusão de ingrediente e produto,
   ficha técnica, Dashboard, DRE, simuladores, PDF e cupom em desktop e celular.
4. Após o dono definir condições comerciais, criar Products/Prices recorrentes na
   Stripe sandbox e configurar o portal sem opções fora do catálogo.
5. Testar checkout, renovação, primeira falha e recuperação de cobrança, inadimplência,
   cancelamento, trial se aprovado, webhook repetido e evento antigo entregue depois.
6. Confirmar que Price desconhecido, segunda assinatura, assinatura expirada e cliente
   de outra conta não liberam acesso.
7. Executar uma exportação Firestore real e restaurá-la em outro projeto. Comparar
   contagens e amostras e validar isolamento. Registrar duração e resultado.

## Cobertura de recuperação

O workflow entregue exporta Firestore. Ele não cobre Firebase Auth, Storage, dados e
configuração Stripe, variáveis/segredos Vercel, DNS, configurações OAuth ou histórico
GitHub. Uma restauração Firestore também não recria usuários Auth; a correspondência
de UIDs precisa ser planejada e testada separadamente.

## Decisões e dados legais pendentes

- razão social, CNPJ/identificação aplicável e endereço do responsável;
- países/regiões de hospedagem e transferências internacionais;
- bases legais por finalidade, operadores/suboperadores e canal do encarregado;
- prazos de retenção para conta, logs, marcadores de exclusão, Stripe e backups;
- planos, preços, periodicidade, limites, reajuste e eventual período gratuito;
- cancelamento, reembolso, inadimplência, tributos e emissão de documentos fiscais;
- disponibilidade, manutenção, encerramento do serviço e foro/lei aplicável;
- revisão jurídica e aprovação final das minutas.

## Bloqueadores atuais de lançamento

- acessos ao projeto Vercel e ao Firebase de homologação;
- conta/sandbox Stripe do responsável e URL estável de Preview;
- teste de compatibilidade com dados existentes e ensaio real de backup/restauração;
- homologação Google OAuth, Stripe e leitura de cupom com serviços reais de teste;
- decisões comerciais e limites ainda não fornecidos;
- conclusão e aprovação jurídica das páginas legais;
- validação fiscal e decisão sobre Stripe Tax;
- execução verde do CI completo com emulador Firestore.
