import { describe, it, expect, afterEach } from "vitest";
import { plans, stripeClient, subscriptionAccess } from "./billing.js";
const catalog = { pro: { name: "Pro", priceId: "price_test", scans: 20 } };
const subscription = {
  status: "active",
  items: { data: [{ price: { id: "price_test" }, current_period_end: 2000 }] },
  latest_invoice: { status: "paid" },
};
afterEach(() => {
  delete process.env.BILLING_PLANS_JSON;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_LIVE_MODE;
});
describe("entitlements", () => {
  it("libera apenas plano conhecido pago e ainda vigente", () => {
    expect(subscriptionAccess(subscription, catalog, 1000)).toEqual({
      active: true,
      planId: "pro",
      scanLimit: 20,
      accessUntil: 2000,
    });
    for (const status of [
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "paused",
    ])
      expect(
        subscriptionAccess({ ...subscription, status }, catalog, 1000).active,
      ).toBe(false);
    expect(subscriptionAccess(subscription, {}, 1000).active).toBe(false);
    expect(subscriptionAccess(subscription, catalog, 2001).active).toBe(false);
    expect(
      subscriptionAccess(
        { ...subscription, latest_invoice: { status: "open" } },
        catalog,
        1000,
      ).active,
    ).toBe(false);
  });
  it("não confunde assinatura ativa com pagamento confirmado", () => {
    expect(
      subscriptionAccess(
        { ...subscription, latest_invoice: "in_pending" },
        catalog,
        1000,
      ).active,
    ).toBe(false);
  });
  it("acompanha renovação, falha e cancelamento pelo estado atual", () => {
    const renewed = {
      ...subscription,
      items: {
        data: [{ price: { id: "price_test" }, current_period_end: 3000 }],
      },
      latest_invoice: { status: "paid" },
    };
    expect(subscriptionAccess(renewed, catalog, 2000).accessUntil).toBe(3000);
    expect(
      subscriptionAccess(
        { ...renewed, latest_invoice: { status: "open" } },
        catalog,
        2000,
      ).active,
    ).toBe(false);
    expect(
      subscriptionAccess({ ...renewed, status: "canceled" }, catalog, 2000)
        .active,
    ).toBe(false);
  });
  it("rejeita catálogo sem limite válido", () => {
    process.env.BILLING_PLANS_JSON = JSON.stringify({
      pro: { name: "Pro", priceId: "price_test", scans: -1 },
    });
    expect(() => plans()).toThrow();
    process.env.BILLING_PLANS_JSON = JSON.stringify(catalog);
    expect(plans()).toEqual(catalog);
  });
  it("rejeita priceId duplicado e nome vazio no catálogo", () => {
    process.env.BILLING_PLANS_JSON = JSON.stringify({
      basic: { name: "Básico", priceId: "price_same", scans: 10 },
      pro: { name: "Pro", priceId: "price_same", scans: 20 },
    });
    expect(() => plans()).toThrow();
    process.env.BILLING_PLANS_JSON = JSON.stringify({
      basic: { name: "  ", priceId: "price_basic", scans: 10 },
    });
    expect(() => plans()).toThrow();
  });
  it("bloqueia chave live sem autorização explícita do ambiente", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.STRIPE_LIVE_MODE = "false";
    expect(() => stripeClient()).toThrow(/produção bloqueada/);
  });
});
