import { describe, it, expect, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({
  records: new Map(),
  subscriptions: vi.fn(),
  createSession: vi.fn(),
  createCustomer: vi.fn(),
  retrieveSession: vi.fn(),
  expire: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    constructor() {
      this.subscriptions = { list: state.subscriptions };
      this.customers = { create: state.createCustomer };
      this.prices = {
        retrieve: async () => ({ active: true, type: "recurring" }),
      };
      this.checkout = {
        sessions: {
          create: state.createSession,
          retrieve: state.retrieveSession,
          expire: state.expire,
        },
      };
    }
  },
}));
vi.mock("./platform.js", async (original) => {
  const actual = await original();
  const ref = (path) => ({
    path,
    get: async () => ({
      exists: state.records.has(path),
      data: () => state.records.get(path),
    }),
    set: async (data) =>
      state.records.set(path, { ...state.records.get(path), ...data }),
  });
  return {
    ...actual,
    services: () => ({
      db: {
        doc: ref,
        batch: () => {
          const pending = [];
          return {
            set: (r, data) => pending.push([r, data]),
            commit: async () => {
              for (const [r, data] of pending) await r.set(data);
            },
          };
        },
      },
    }),
    accountLock: async (uid, op) =>
      op(state.records.get(`accounts/${uid}`) || {}, ref(`accounts/${uid}`)),
    appOrigin: () => "https://example.test",
  };
});
import { synchronizeCustomer, checkout } from "./billing.js";
beforeEach(() => {
  vi.clearAllMocks();
  state.records.clear();
  process.env.STRIPE_SECRET_KEY = "local-test";
  process.env.BILLING_ENABLED = "true";
  process.env.LEGAL_APPROVED = "true";
  process.env.BILLING_PLANS_JSON = JSON.stringify({
    pro: { name: "Pro", priceId: "price_pro", scans: 10 },
  });
  state.records.set("stripeCustomers/cus_owner", { uid: "alice" });
  state.records.set("accounts/alice", { customerId: "cus_owner" });
  state.subscriptions.mockResolvedValue({ data: [] });
  state.createSession.mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/test",
  });
});
describe("sincronização de assinatura", () => {
  it("lê estado atual, aplica uma vez e ignora repetição", async () => {
    state.subscriptions.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          items: {
            data: [
              {
                price: { id: "price_pro" },
                current_period_end: Math.floor(Date.now() / 1000) + 3600,
              },
            ],
          },
          latest_invoice: { status: "paid" },
        },
      ],
    });
    await synchronizeCustomer("cus_owner", "evt_1");
    expect(state.records.get("accounts/alice").active).toBe(true);
    await synchronizeCustomer("cus_owner", "evt_1");
    expect(state.subscriptions).toHaveBeenCalledTimes(1);
    state.subscriptions.mockResolvedValue({
      data: [{ id: "sub_1", status: "canceled", items: { data: [] } }],
    });
    await synchronizeCustomer("cus_owner", "evt_older_arrived_late");
    expect(state.records.get("accounts/alice").active).toBe(false);
  });
  it("não cria conta para customer desconhecido", async () => {
    await synchronizeCustomer("cus_intruder", "evt_unknown");
    expect(state.subscriptions).not.toHaveBeenCalled();
  });
  it("não altera conta em exclusão", async () => {
    state.records.set("accounts/alice", {
      customerId: "cus_owner",
      deleting: true,
    });
    await synchronizeCustomer("cus_owner", "evt_1");
    expect(state.subscriptions).not.toHaveBeenCalled();
  });
  it("ignora preço enviado pelo cliente e só usa plano configurado no servidor", async () => {
    await expect(checkout({ uid: "alice" }, "price_attack")).rejects.toThrow();
    await checkout({ uid: "alice" }, "pro");
    const args = state.createSession.mock.calls[0][0];
    expect(args.line_items).toEqual([{ price: "price_pro", quantity: 1 }]);
    expect(args).not.toHaveProperty("payment_method_types");
    expect(args.mode).toBe("subscription");
  });
  it("não cria outra assinatura quando já existe uma", async () => {
    state.subscriptions.mockResolvedValue({ data: [{ status: "past_due" }] });
    await expect(checkout({ uid: "alice" }, "pro")).rejects.toThrow(/já tem/);
    expect(state.createSession).not.toHaveBeenCalled();
  });
  it("reutiliza checkout aberto", async () => {
    state.records.set("accounts/alice", {
      customerId: "cus_owner",
      checkoutId: "cs_1",
      checkoutPlan: "pro",
    });
    state.retrieveSession.mockResolvedValue({
      status: "open",
      url: "https://checkout.stripe.com/old",
    });
    expect(await checkout({ uid: "alice" }, "pro")).toEqual({
      url: "https://checkout.stripe.com/old",
    });
    expect(state.createSession).not.toHaveBeenCalled();
  });
  it("recupera checkout removido e cria uma nova sessão sem parâmetro não suportado", async () => {
    state.records.set("accounts/alice", {
      customerId: "cus_owner",
      checkoutId: "cs_missing",
      checkoutPlan: "pro",
      checkoutNonce: "old-nonce",
    });
    state.retrieveSession.mockRejectedValue(
      Object.assign(new Error("missing"), { code: "resource_missing" }),
    );

    await checkout({ uid: "alice" }, "pro");

    const params = state.createSession.mock.calls[0][0];
    expect(params).not.toHaveProperty("integration_identifier");
    expect(params.line_items).toEqual([{ price: "price_pro", quantity: 1 }]);
    expect(state.createSession.mock.calls[0][1].idempotencyKey).not.toContain(
      "old-nonce",
    );
  });
  it("repara o mapeamento de customer legado sem permitir troca de dono", async () => {
    state.records.delete("stripeCustomers/cus_owner");
    await checkout({ uid: "alice" }, "pro");
    expect(state.records.get("stripeCustomers/cus_owner")).toEqual({
      uid: "alice",
    });

    state.records.set("stripeCustomers/cus_owner", { uid: "bob" });
    await expect(checkout({ uid: "alice" }, "pro")).rejects.toThrow(
      /revisão pelo suporte/,
    );
  });
});
