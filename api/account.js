import { Timestamp } from "firebase-admin/firestore";
import {
  endpoint,
  authenticate,
  services,
  HttpError,
  accountLock,
} from "../server/platform.js";
import { stripeClient, listSubscriptions } from "../server/billing.js";
const collections = [
  "products",
  "ingredients",
  "dre",
  "simulations",
  "reports",
];
export default endpoint(["GET", "DELETE"], async (req) => {
  const user = await authenticate(req, req.method === "DELETE");
  const { db, auth } = services();
  if (req.method === "GET") {
    const kind = req.query?.collection;
    if (!kind) {
      const profile = await db.doc(`users/${user.uid}`).get();
      const account = await db.doc(`accounts/${user.uid}`).get();
      const a = account.data() || {};
      return {
        profile: profile.data() || {},
        identity: { uid: user.uid, email: user.email || null },
        billing: {
          customerId: a.customerId || null,
          planId: a.planId || null,
          subscriptionStatus: a.subscriptionStatus || "none",
        },
        collections,
      };
    }
    if (!collections.includes(kind) && kind !== "usage")
      throw new HttpError(400, "Coleção inválida.");
    const cursor = req.query?.cursor;
    if (
      cursor &&
      (typeof cursor !== "string" ||
        cursor.includes("/") ||
        cursor.length > 1500)
    )
      throw new HttpError(400, "Página inválida.");
    let query = db
      .collection(
        `${kind === "usage" ? "accounts" : "users"}/${user.uid}/${kind}`,
      )
      .orderBy("__name__")
      .limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    const items = [];
    let bytes = 0;
    for (const doc of page.docs) {
      const item = { ...doc.data(), id: doc.id };
      const size = Buffer.byteLength(JSON.stringify(item));
      if (items.length && bytes + size > 2000000) break;
      items.push(item);
      bytes += size;
    }
    const more = items.length < page.size || page.size === 100;
    return { items, nextCursor: more ? items.at(-1)?.id : null };
  }
  if (req.body?.confirmation !== "EXCLUIR MINHA CONTA")
    throw new HttpError(400, "Confirme a exclusão da conta.");
  return accountLock(
    user.uid,
    async (account, ref) => {
      // Lock Firestore writes before removing any personal data. Retries resume deletion.
      await ref.set({ deleting: true }, { merge: true });
      if (account.customerId && !account.billingDeleted) {
        const stripe = stripeClient();
        let subscriptions;
        try {
          subscriptions = await listSubscriptions(stripe, account.customerId);
        } catch (error) {
          if (error.code !== "resource_missing") throw error;
          subscriptions = { data: [] };
        }
        for (const s of subscriptions.data)
          if (!["canceled", "incomplete_expired"].includes(s.status))
            await stripe.subscriptions.cancel(s.id, {
              invoice_now: false,
              prorate: false,
            });
        // Deleting the customer also closes open checkout sessions' ability to charge it.
        try {
          await stripe.customers.del(account.customerId);
        } catch (error) {
          if (error.code !== "resource_missing") throw error;
        }
        await ref.set({ billingDeleted: true }, { merge: true });
      }
      await db.recursiveDelete(db.doc(`users/${user.uid}`));
      await db.recursiveDelete(ref.collection("usage"));
      await db.doc(`admins/${user.uid}`).delete();
      if (account.customerId)
        await db.doc(`stripeCustomers/${account.customerId}`).delete();
      // Keep a minimal deletion lock; no profile or email. It prevents stale requests re-creating data.
      await ref.set({
        deleting: true,
        deleted: true,
        active: false,
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000),
      });
      try {
        await auth.deleteUser(user.uid);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
      }
      return { deleted: true };
    },
    true,
  );
});
