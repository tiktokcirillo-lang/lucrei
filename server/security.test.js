import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import Stripe from "stripe";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sync: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("./platform.js", async (original) => ({
  ...(await original()),
  authenticate: mocks.auth,
}));
vi.mock("./billing.js", async (original) => ({
  ...(await original()),
  stripeClient: mocks.stripe,
  synchronizeCustomer: mocks.sync,
}));
import webhook from "../api/stripe-webhook.js";
import scanner from "../api/anthropic.js";
function response() {
  return {
    headersSent: false,
    statusCode: 200,
    setHeader: vi.fn(),
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockRejectedValue(new Error("no auth"));
  process.env.STRIPE_WEBHOOK_SECRET = "local-test-signing-secret";
});
describe("segurança de endpoints", () => {
  it("recusa assinatura de webhook inválida antes de processar", async () => {
    const client = new Stripe("local-test");
    mocks.stripe.mockReturnValue(client);
    const req = Readable.from([Buffer.from("{}")]);
    req.method = "POST";
    req.headers = { "stripe-signature": "invalid" };
    const res = response();
    await webhook(req, res);
    expect(res.statusCode).toBe(400);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("aceita evento assinado e resolve pelo customer, ignorando metadata de usuário", async () => {
    const client = new Stripe("local-test");
    mocks.stripe.mockReturnValue(client);
    const payload = JSON.stringify({
      id: "evt_local",
      type: "invoice.paid",
      data: {
        object: { customer: "cus_owner", metadata: { uid: "attacker" } },
      },
    });
    const header = client.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const req = Readable.from([Buffer.from(payload)]);
    req.method = "POST";
    req.headers = { "stripe-signature": header };
    const res = response();
    await webhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith("cus_owner", "evt_local");
  });
  it("não devolve conteúdo de erros internos ou credenciais", async () => {
    const req = { method: "POST", headers: {}, body: {} };
    const res = response();
    await scanner(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).not.toContain("no auth");
    expect(res.body.requestId).toBeTruthy();
  });
});
