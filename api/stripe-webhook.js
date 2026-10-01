import { endpoint, HttpError } from "../server/platform.js";
import { stripeClient, synchronizeCustomer } from "../server/billing.js";
export const config = { api: { bodyParser: false } };
export default endpoint(["POST"], async (req) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    throw new HttpError(503, "Webhook não configurado.");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1000000) throw new HttpError(413, "Evento muito grande.");
    chunks.push(Buffer.from(chunk));
  }
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      Buffer.concat(chunks),
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new HttpError(400, "Assinatura do evento inválida.");
  }
  const relevant =
    event.type.startsWith("customer.subscription.") ||
    [
      "invoice.paid",
      "invoice.payment_failed",
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ].includes(event.type);
  if (relevant) {
    const value = event.data.object.customer;
    const customerId = typeof value === "string" ? value : value?.id;
    if (customerId) await synchronizeCustomer(customerId, event.id);
  }
  return { received: true };
});
