import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { services, HttpError, accountLock, appOrigin } from "./platform.js";
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new HttpError(503, "Cobrança ainda não configurada.");
  if (
    /^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY) &&
    process.env.STRIPE_LIVE_MODE !== "true"
  )
    throw new HttpError(
      503,
      "Chave Stripe de produção bloqueada neste ambiente.",
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-09-30.endive",
    timeout: 15000,
    maxNetworkRetries: 1,
  });
}
export function plans() {
  let catalog;
  try {
    catalog = JSON.parse(process.env.BILLING_PLANS_JSON || "{}");
  } catch {
    throw new HttpError(503, "Planos ainda não configurados.");
  }
  if (!catalog || Array.isArray(catalog) || typeof catalog !== "object")
    throw new HttpError(503, "Planos inválidos.");
  const priceIds = new Set();
  for (const [id, plan] of Object.entries(catalog)) {
    if (
      !/^[a-z0-9_-]{1,40}$/.test(id) ||
      !/^price_[A-Za-z0-9]+$/.test(plan.priceId) ||
      typeof plan.name !== "string" ||
      !plan.name.trim() ||
      plan.name.length > 80 ||
      !Number.isSafeInteger(plan.scans) ||
      plan.scans < 0 ||
      priceIds.has(plan.priceId)
    )
      throw new HttpError(503, "Planos inválidos.");
    priceIds.add(plan.priceId);
  }
  return catalog;
}
export async function ensureCustomerMapping(customerId, uid) {
  const ref = services().db.doc(`stripeCustomers/${customerId}`);
  const current = await ref.get();
  if (current.exists && current.data()?.uid !== uid)
    throw new HttpError(409, "Cliente de cobrança requer revisão pelo suporte.");
  if (!current.exists) await ref.set({ uid });
}
export async function listSubscriptions(stripe, customerId, expand) {
  const all = [];
  let cursor;
  do {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
      ...(expand ? { expand: ["data.latest_invoice"] } : {}),
    });
    all.push(...page.data);
    if (all.length > 1000)
      throw new HttpError(503, "Conta requer revisão pelo suporte.");
    cursor = page.has_more ? page.data.at(-1)?.id : null;
  } while (cursor);
  return { data: all };
}
export async function checkout(user, planId) {
  const catalog = plans();
  const plan =
    typeof planId === "string" && Object.hasOwn(catalog, planId)
      ? catalog[planId]
      : null;
  if (!plan) throw new HttpError(400, "Plano indisponível.");
  if (
    process.env.BILLING_ENABLED !== "true" ||
    process.env.LEGAL_APPROVED !== "true"
  )
    throw new HttpError(503, "Assinaturas ainda não disponíveis.");
  const stripe = stripeClient();
  return accountLock(user.uid, async (account, ref) => {
    let customerId = account.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email },
        { idempotencyKey: `customer-${user.uid}` },
      );
      customerId = customer.id;
      const batch = services().db.batch();
      batch.set(ref, { customerId }, { merge: true });
      batch.set(services().db.doc(`stripeCustomers/${customerId}`), {
        uid: user.uid,
      });
      await batch.commit();
    } else {
      await ensureCustomerMapping(customerId, user.uid);
    }
    const existing = await listSubscriptions(stripe, customerId);
    if (
      existing.data.some(
        (s) => !["canceled", "incomplete_expired"].includes(s.status),
      )
    )
      throw new HttpError(
        409,
        "Você já tem uma assinatura. Use Gerenciar assinatura.",
      );
    let checkoutNonce = account.checkoutNonce;
    if (account.checkoutId) {
      let pending;
      try {
        pending = await stripe.checkout.sessions.retrieve(account.checkoutId);
      } catch (error) {
        if (error?.code !== "resource_missing") throw error;
        await ref.set(
          { checkoutId: null, checkoutPlan: null, checkoutNonce: null },
          { merge: true },
        );
        checkoutNonce = null;
      }
      if (pending) {
        if (pending.status === "open") {
          if (account.checkoutPlan === planId) return { url: pending.url };
          await stripe.checkout.sessions.expire(pending.id);
        }
        if (
          pending.status === "complete" &&
          existing.data.some(
            (s) =>
              s.id ===
                (typeof pending.subscription === "string"
                  ? pending.subscription
                  : pending.subscription?.id) &&
              !["canceled", "incomplete_expired"].includes(s.status),
          )
        )
          throw new HttpError(
            409,
            "Pagamento em processamento. Aguarde a confirmação.",
          );
      }
    }
    const price = await stripe.prices.retrieve(plan.priceId);
    if (!price.active || price.type !== "recurring")
      throw new HttpError(503, "Preço indisponível.");
    const nonce = checkoutNonce || randomBytes(12).toString("hex");
    await ref.set({ checkoutNonce: nonce }, { merge: true });
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        success_url: `${appOrigin()}/conta?checkout=success`,
        cancel_url: `${appOrigin()}/conta?checkout=cancel`,
      },
      { idempotencyKey: `checkout-${user.uid}-${planId}-${nonce}` },
    );
    await ref.set(
      { checkoutId: session.id, checkoutPlan: planId, checkoutNonce: null },
      { merge: true },
    );
    return { url: session.url };
  });
}
export function subscriptionAccess(
  subscription,
  catalog,
  now = Date.now() / 1000,
) {
  const item = subscription.items?.data?.[0];
  const entry = Object.entries(catalog).find(
    ([, p]) => p.priceId === item?.price?.id,
  );
  const invoice = subscription.latest_invoice;
  const paid =
    subscription.status === "active" &&
    invoice &&
    typeof invoice === "object" &&
    invoice.status === "paid";
  const trial =
    subscription.status === "trialing" && subscription.trial_end > now;
  const end = trial ? subscription.trial_end : item?.current_period_end;
  const valid = Boolean(
    entry &&
    (paid || trial) &&
    end > now &&
    subscription.items.data.length === 1,
  );
  return {
    active: valid,
    planId: valid ? entry[0] : null,
    scanLimit: valid ? entry[1].scans : 0,
    accessUntil: valid ? end : 0,
  };
}
export async function synchronizeCustomer(customerId, eventId) {
  const { db } = services();
  const mapping = await db.doc(`stripeCustomers/${customerId}`).get();
  if (!mapping.exists) return;
  const uid = mapping.data().uid;
  return accountLock(uid, async (account, ref) => {
    if (account.customerId !== customerId || account.deleting) return;
    const eventRef = db.doc(`stripeEvents/${eventId}`);
    if ((await eventRef.get()).exists) return;
    // Read current Stripe state instead of applying an old event's snapshot.
    const stripe = stripeClient();
    const subscriptions = await listSubscriptions(stripe, customerId, true);
    const candidates = subscriptions.data.map((s) => ({
      subscription: s,
      ...subscriptionAccess(s, plans()),
    }));
    const chosen = candidates
      .filter((c) => c.active)
      .sort((a, b) => b.accessUntil - a.accessUntil)[0];
    const batch = db.batch();
    batch.set(
      ref,
      {
        active: Boolean(chosen),
        planId: chosen?.planId || null,
        scanLimit: chosen?.scanLimit || 0,
        accessUntil: Timestamp.fromMillis((chosen?.accessUntil || 0) * 1000),
        subscriptionId: chosen?.subscription.id || null,
        subscriptionStatus:
          chosen?.subscription.status ||
          subscriptions.data[0]?.status ||
          "none",
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    batch.set(eventRef, {
      processedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000),
    });
    await batch.commit();
  });
}
