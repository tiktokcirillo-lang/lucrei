import { plans } from "../server/billing.js";
const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_ADMIN_CREDENTIALS_JSON",
  "APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) console.log("Configurar no servidor:", missing.join(", "));
const catalog = plans();
if (!Object.keys(catalog).length)
  console.log("Planos e limites ainda não definidos.");
if (process.env.LEGAL_APPROVED !== "true")
  console.log("Minutas legais ainda precisam ser finalizadas e aprovadas.");
if (process.env.BILLING_ENABLED !== "true") console.log("Cobrança desativada.");
if (!Number(process.env.AI_GLOBAL_MONTHLY_LIMIT))
  console.log("Leitura de cupons desativada pelo limite global.");
if (
  missing.length ||
  !Object.keys(catalog).length ||
  process.env.LEGAL_APPROVED !== "true"
)
  process.exit(1);
console.log(
  "Configuração mínima presente. Homologação externa continua necessária.",
);
