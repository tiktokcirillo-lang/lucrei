import { services } from "../server/platform.js";
const project = process.env.FIREBASE_PROJECT_ID;
if (!project || process.argv[2] !== project)
  throw new Error(
    "Informe o projeto explicitamente: node scripts/bootstrap.mjs SEU_PROJECT_ID",
  );
if (!["true", "false"].includes(process.env.REQUIRE_SUBSCRIPTION))
  throw new Error("Defina REQUIRE_SUBSCRIPTION como true ou false.");
await services()
  .db.doc("accessPolicy/public")
  .set({ requireSubscription: process.env.REQUIRE_SUBSCRIPTION === "true" });
console.log(
  "Política de acesso atualizada. Nenhum preço ou assinatura foi criado.",
);
