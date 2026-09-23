# Auditoria de preparação SaaS — Lucrei

Data: 23/09/2026

## Resumo executivo

O Lucrei já possui um núcleo de produto útil: autenticação, onboarding, precificação, ingredientes, simuladores, DRE, relatórios e leitura de cupons por IA. A arquitetura atual funciona como MVP individual, mas ainda não deve ser comercializada como SaaS pago sem uma camada de cobrança, autorização por plano, controle de custos da IA, observabilidade e revisão das fórmulas financeiras.

## Estado verificado

- Front-end: React 19, Vite 8 e Tailwind CSS 4.
- Dados e autenticação: Firebase Authentication e Firestore.
- API: função serverless na Vercel como proxy para a Anthropic.
- PWA: service worker e manifesto configurados.
- Isolamento atual: dados de produtos e ingredientes ficam sob `users/{uid}`.
- Qualidade após o primeiro lote: lint aprovado, 7 testes aprovados, build aprovado e `npm audit` sem vulnerabilidades conhecidas.

## Bloqueadores para venda

### P0 — antes de aceitar pagamentos

1. **Cobrança e autorização por plano**
   - Não há checkout, assinatura, período de teste, cancelamento, inadimplência ou webhook de pagamento.
   - Não há campo de plano confiável nem verificação server-side de entitlement.
   - Recursos pagos não podem ser protegidos apenas no front-end.

2. **Controle de custo da IA**
   - Qualquer usuário autenticado pode solicitar leituras de cupons sem cota persistente.
   - Ainda faltam rate limit por usuário, limite por plano, registro de consumo e proteção contra repetição.
   - O primeiro lote limita tamanho, formato e quantidade do payload, mas isso não substitui uma cota.

3. **Revisão das fórmulas financeiras**
   - A tela DRE permite selecionar meses, mas não existem lançamentos ou datas de venda; a seleção altera apenas o rótulo.
   - A opção anual usa os mesmos volumes e custos fixos de um mês.
   - O dashboard chama margem de contribuição de “Lucro”, sem descontar os custos fixos mensais.
   - O EBITDA atual soma deduções fiscais ao resultado, o que não representa corretamente o indicador.
   - O simulador de bundle não desconta impostos nem taxas percentuais no resultado do pacote.
   - As alíquotas automáticas são estimativas fixas por regime e não consideram atividade, faixa ou particularidades tributárias. O usuário precisa poder informar uma alíquota efetiva, com aviso claro de que não é aconselhamento contábil.

4. **Proteção operacional**
   - O App Check foi removido após falhas de configuração. Ele deve voltar primeiro em modo de monitoramento e só depois ser exigido.
   - Faltam logs estruturados, rastreamento de erros, métricas e alertas.
   - Faltam testes automatizados das regras do Firestore com o Emulator Suite.

5. **LGPD e confiança**
   - Faltam Termos de Uso, Política de Privacidade, consentimentos necessários e canal de suporte.
   - Faltam exportação e exclusão de conta/dados.
   - Imagens de cupons podem conter dados pessoais e precisam de política de retenção explícita. Atualmente a imagem é enviada para análise, mas não é persistida pelo app.

### P1 — versão beta paga

1. Criar organizações/negócios separados do documento de usuário para permitir equipe e múltiplas empresas.
2. Criar papéis de proprietário, administrador e membro.
3. Versionar cálculos salvos para impedir que alterações futuras mudem silenciosamente resultados antigos.
4. Adicionar histórico de preços e custos por data.
5. Trocar a DRE projetada por períodos reais baseados em lançamentos ou deixar explícito que se trata de projeção.
6. Adicionar backups, procedimento de recuperação e ambiente de homologação.
7. Adicionar testes unitários das fórmulas, testes de integração do Firestore e um fluxo E2E de login/onboarding/produto.

### P2 — crescimento

1. Landing page pública, preços, FAQ e demonstração do produto.
2. Onboarding guiado por segmento e modelos de custo.
3. Eventos de produto para ativação, retenção e conversão.
4. Central de ajuda, suporte e academia com conteúdo administrável.
5. Convites de equipe, múltiplos negócios e permissões.
6. Otimização de bundle: a tela de ingredientes ainda gera um arquivo JavaScript acima de 1,3 MB e deve carregar bibliotecas pesadas somente quando o scanner for aberto.

## Sequência recomendada

### Fase 1 — estabilidade

- manter lint, testes, build e auditoria no CI;
- concluir testes das regras do Firestore;
- corrigir cálculos e nomes dos indicadores;
- adicionar tratamento de erros visível ao usuário;
- reativar App Check em monitoramento.

### Fase 2 — fundação SaaS

- definir ICP e planos;
- implementar cobrança e webhooks;
- criar entitlement server-side e limites de IA;
- adicionar observabilidade, suporte e páginas legais;
- criar ambiente de homologação.

### Fase 3 — beta controlada

- liberar para um grupo pequeno de clientes;
- acompanhar ativação, erros, consumo de IA e precisão dos cálculos;
- corrigir problemas antes da abertura pública.

## Decisões de produto necessárias

1. Público inicial: alimentação, varejo de produtos físicos ou pequenos negócios em geral.
2. Unidade da assinatura: por usuário, por empresa ou por número de produtos/análises.
3. Limites por plano: produtos, empresas, usuários, PDFs e leituras de cupom.
4. O que será cálculo estimado e o que será relatório contábil baseado em dados reais.
5. Se o primeiro lançamento será somente Brasil ou também Japão.
