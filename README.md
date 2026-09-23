# Lucrei

Aplicação web para cálculo de preço, margem, ponto de equilíbrio e cenários comerciais. O produto usa React, Firebase e uma função serverless para leitura de cupons com IA.

## Funcionalidades atuais

- autenticação com Google;
- onboarding do negócio e custos fixos;
- cadastro de ingredientes e produtos;
- ficha técnica e cálculo de preço;
- dashboard, DRE estimada e relatórios em PDF;
- simuladores de desconto, bundle e frete grátis;
- leitura de cupons por imagem;
- PWA instalável.

## Requisitos

- Node.js 20 ou superior;
- projeto Firebase com Authentication e Firestore;
- conta Anthropic para a leitura de cupons;
- Vercel ou ambiente compatível com a função em `api/anthropic.js`.

## Configuração local

1. Instale as dependências:

   ```bash
   npm ci
   ```

2. Copie `.env.example` para `.env.local` e preencha as variáveis.

3. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

O front-end usa apenas variáveis `VITE_*`. `ANTHROPIC_API_KEY` deve existir somente no ambiente serverless e nunca pode ser exposta ao navegador.

## Qualidade

```bash
npm run lint
npm test
npm run build
npm audit
```

## Firestore

As regras ficam em `firestore.rules`. Antes de publicar, configure o projeto correto e valide as regras com o Firebase Emulator Suite. A estrutura atual isola os documentos por `users/{uid}`.

## Estado do produto

O Lucrei está em fase de preparação para SaaS. Antes de abrir vendas, ainda são necessários controle de assinatura e limites de uso, observabilidade, testes das regras do Firestore, revisão das fórmulas financeiras, termos e privacidade, exportação/exclusão de dados e uma rotina segura de backup e recuperação.
