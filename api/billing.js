import {
  endpoint,
  authenticate,
  services,
  HttpError,
  appOrigin,
  accountLock,
} from "../server/platform.js";
import {
  plans,
  stripeClient,
  checkout,
  ensureCustomerMapping,
} from "../server/billing.js";
export default endpoint(["GET", "POST"], async (req) => {
  const user = await authenticate(req);
  const ref = services().db.doc(`accounts/${user.uid}`);
  if (req.method === "GET") {
    const account = (await ref.get()).data() || {};
    const catalog = plans();
    const enabled =
      process.env.BILLING_ENABLED === "true" &&
      process.env.LEGAL_APPROVED === "true";
    const available = enabled
      ? await Promise.all(
          Object.entries(catalog).map(async ([id, p]) => {
            const price = await stripeClient().prices.retrieve(p.priceId);
            return {
              id,
              name: p.name,
              scans: p.scans,
              amount: price.unit_amount,
              currency: price.currency,
              interval: price.recurring?.interval,
              intervalCount: price.recurring?.interval_count,
            };
          }),
        )
      : [];
    const month = new Date().toISOString().slice(0, 7);
    const usage = (
      await services().db.doc(`accounts/${user.uid}/usage/${month}`).get()
    ).data();
    return {
      enabled,
      plans: available,
      active: Boolean(
        account.active && account.accessUntil?.toMillis() > Date.now(),
      ),
      status: account.subscriptionStatus || "none",
      planId: account.planId || null,
      used: usage?.count || 0,
      limit: account.scanLimit || 0,
      hasCustomer: Boolean(account.customerId),
      deleting: Boolean(account.deleting),
    };
  }
  if (req.body?.action === "checkout") return checkout(user, req.body.planId);
  if (req.body?.action === "portal")
    return accountLock(user.uid, async (account) => {
      if (!account.customerId)
        throw new HttpError(400, "Nenhuma assinatura cadastrada.");
      await ensureCustomerMapping(account.customerId, user.uid);
      return {
        url: (
          await stripeClient().billingPortal.sessions.create({
            customer: account.customerId,
            return_url: `${appOrigin()}/conta`,
          })
        ).url,
      };
    });
  throw new HttpError(400, "Ação inválida.");
});
