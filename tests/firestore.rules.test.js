import { readFileSync } from "node:fs";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
const authMock = vi.hoisted(() => ({ deleteUser: vi.fn() }));
vi.mock("../server/platform.js", async (original) => {
  const actual = await original();
  return {
    ...actual,
    authenticate: async () => ({ uid: "alice", email: "alice@example.test" }),
    services: () => ({ ...actual.services(), auth: authMock }),
  };
});
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const company = {
  name: "Loja",
  productType: "Produto Físico",
  salesChannel: "Loja física",
  taxRegime: "mei",
  effectiveTaxRatePct: 0,
  fixedCosts: { rent: 100 },
};
const product = {
  name: "Bolo",
  inputs: { productName: "Bolo", insumos: 2, volumeEstimado: 10, margem: 30 },
  results: {},
};
const ingredient = {
  name: "Farinha",
  purchaseUnit: "kg",
  purchaseQty: 1,
  purchasePrice: 5,
  unitsPerPackage: null,
  baseUnit: "g",
  costPerBaseUnit: 0.005,
};
describe.skipIf(!enabled)("regras em Firestore real emulado", () => {
  let env;
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = "demo-lucrei";
    env = await initializeTestEnvironment({
      projectId: "demo-lucrei",
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accessPolicy/public"), {
        requireSubscription: false,
      });
    });
  });
  afterAll(async () => env?.cleanup());
  for (const [path, value] of [
    ["users/alice", { company }],
    ["users/alice/products/p", product],
    ["users/alice/ingredients/i", ingredient],
  ]) {
    it(`dono grava, outra conta e visitante não acessam ${path}`, async () => {
      const db = env.authenticatedContext("alice").firestore();
      await assertSucceeds(setDoc(doc(db, path), value));
      await assertSucceeds(getDoc(doc(db, path)));
      for (const other of [
        env.authenticatedContext("bob").firestore(),
        env.unauthenticatedContext().firestore(),
      ]) {
        await assertFails(getDoc(doc(other, path)));
        await assertFails(setDoc(doc(other, path), value));
      }
    });
  }
  it("bloqueia listagem de outra conta, admin e plano forjado", async () => {
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(getDocs(collection(db, "users/alice/products")));
    for (const path of [
      "admins/bob",
      "accounts/bob",
      "accounts/bob/usage/2026-10",
      "accessPolicy/public",
      "stripeCustomers/cus_fake",
      "serviceUsage/2026-10",
    ])
      await assertFails(setDoc(doc(db, path), { active: true }));
  });
  it("recusa campos extras e números negativos", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice"), { company, admin: true }));
    await assertFails(
      setDoc(doc(db, "users/alice/products/p"), {
        ...product,
        inputs: { ...product.inputs, insumos: -1 },
      }),
    );
    await assertFails(
      setDoc(doc(db, "users/alice/ingredients/i"), {
        ...ingredient,
        purchaseQty: 0,
      }),
    );
  });
  it("exige plano ativo não expirado quando cobrança está habilitada", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accessPolicy/public"), {
        requireSubscription: true,
      });
    });
    await assertFails(setDoc(doc(db, "users/alice/products/p"), product));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accounts/alice"), {
        active: true,
        accessUntil: Timestamp.fromMillis(Date.now() + 60000),
      });
    });
    await assertSucceeds(setDoc(doc(db, "users/alice/products/p"), product));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accounts/alice"), {
        active: true,
        accessUntil: Timestamp.fromMillis(0),
      });
    });
    await assertFails(setDoc(doc(db, "users/alice/products/p"), product));
    await assertSucceeds(getDoc(doc(db, "users/alice/products/p")));
  });
  it("bloqueia gravações durante exclusão e exclusão direta da raiz", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accounts/alice"), { deleting: true });
    });
    await assertFails(setDoc(doc(db, "users/alice/products/p"), product));
    await assertFails(deleteDoc(doc(db, "users/alice")));
  });
  it("reserva cotas de IA atomicamente, sem ultrapassar o limite em concorrência", async () => {
    process.env.FIREBASE_PROJECT_ID = "demo-lucrei";
    process.env.AI_GLOBAL_MONTHLY_LIMIT = "10";
    const { reserveScan } = await import("../server/receipts.js");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "accounts/scanner"), {
        active: true,
        accessUntil: Timestamp.fromMillis(Date.now() + 60000),
        scanLimit: 3,
      });
    });
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => reserveScan("scanner")),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(3);
    delete process.env.AI_GLOBAL_MONTHLY_LIMIT;
  }, 45000);
  it("exporta apenas dados da conta autenticada e não aceita caminhos arbitrários", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/alice/products/p"), product);
      await setDoc(doc(ctx.firestore(), "users/bob/products/secret"), product);
    });
    const { default: handler } = await import("../api/account.js");
    const response = () => ({
      headersSent: false,
      statusCode: 200,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.headersSent = true;
      },
    });
    const res = response();
    await handler(
      {
        method: "GET",
        headers: {},
        query: { collection: "products", uid: "bob" },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.items.map((p) => p.id)).toEqual(["p"]);
    const bad = response();
    await handler(
      { method: "GET", headers: {}, query: { collection: "../bob/products" } },
      bad,
    );
    expect(bad.statusCode).toBe(400);
  });
  it("exclui raiz e subcoleções, mantém bloqueio mínimo e preserva outra conta", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "users/alice"), { company });
      await setDoc(doc(db, "users/alice/products/p"), product);
      await setDoc(doc(db, "users/alice/products/p/private/child"), {
        detail: "data",
      });
      await setDoc(doc(db, "users/bob/products/secret"), product);
      await setDoc(doc(db, "accounts/alice/usage/2026-10"), { count: 2 });
    });
    const { default: handler } = await import("../api/account.js");
    const res = {
      headersSent: false,
      statusCode: 200,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.headersSent = true;
      },
    };
    await handler(
      {
        method: "DELETE",
        headers: {},
        body: { confirmation: "EXCLUIR MINHA CONTA" },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(authMock.deleteUser).toHaveBeenCalledWith("alice");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      expect((await getDoc(doc(db, "users/alice"))).exists()).toBe(false);
      expect(
        (
          await getDoc(doc(db, "users/alice/products/p/private/child"))
        ).exists(),
      ).toBe(false);
      expect(
        (await getDoc(doc(db, "users/bob/products/secret"))).exists(),
      ).toBe(true);
      const marker = (await getDoc(doc(db, "accounts/alice"))).data();
      expect(marker.deleting).toBe(true);
      expect(marker.customerId).toBeUndefined();
    });
  }, 45000);
});
