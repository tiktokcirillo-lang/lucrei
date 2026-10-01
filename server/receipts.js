import { HttpError, services, integerEnv } from "./platform.js";
import { Timestamp } from "firebase-admin/firestore";
export function validateImage(body) {
  if (
    !body ||
    Object.keys(body).some((k) => k !== "image") ||
    typeof body.image !== "string" ||
    body.image.length > 2800000 ||
    !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      body.image,
    )
  )
    throw new HttpError(400, "Envie uma imagem JPEG válida.");
  const bytes = Buffer.from(body.image, "base64");
  if (
    bytes.length < 4 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes[2] !== 255
  )
    throw new HttpError(400, "Imagem JPEG inválida.");
  return body.image;
}
export function validateReceipt(payload) {
  const units = ["kg", "g", "L", "ml", "unidade", "dúzia", "pacote", "caixa"];
  if (!Array.isArray(payload?.items) || payload.items.length > 80)
    throw new HttpError(502, "Não foi possível interpretar o cupom.");
  return {
    items: payload.items.map((item) => {
      if (
        typeof item.name !== "string" ||
        !item.name.trim() ||
        item.name.length > 160 ||
        !units.includes(item.purchaseUnit) ||
        !Number.isFinite(item.purchaseQty) ||
        item.purchaseQty <= 0 ||
        item.purchaseQty > 1000000 ||
        !Number.isFinite(item.purchasePrice) ||
        item.purchasePrice < 0 ||
        item.purchasePrice > 100000000
      )
        throw new HttpError(
          502,
          "O cupom retornou valores inválidos. Tente outra imagem.",
        );
      return {
        name: item.name.trim(),
        purchaseUnit: item.purchaseUnit,
        purchaseQty: item.purchaseQty,
        purchasePrice: item.purchasePrice,
        confidence: ["high", "medium", "low"].includes(item.confidence)
          ? item.confidence
          : "low",
      };
    }),
  };
}
export async function reserveScan(uid, now = Date.now()) {
  const { db } = services();
  const month = new Date(now).toISOString().slice(0, 7);
  const accountRef = db.doc(`accounts/${uid}`),
    usageRef = accountRef.collection("usage").doc(month),
    globalRef = db.doc(`serviceUsage/${month}`);
  const globalLimit = integerEnv("AI_GLOBAL_MONTHLY_LIMIT");
  if (!globalLimit)
    throw new HttpError(503, "Leitura de cupons ainda não disponível.");
  return db.runTransaction(async (tx) => {
    const [a, u, g] = await Promise.all([
      tx.get(accountRef),
      tx.get(usageRef),
      tx.get(globalRef),
    ]);
    const account = a.data() || {},
      usage = u.data() || {},
      global = g.data() || {};
    if (account.deleting) throw new HttpError(409, "Exclusão em andamento.");
    if (
      !account.active ||
      account.accessUntil?.toMillis() <= now ||
      !account.accessUntil
    )
      throw new HttpError(403, "Ative uma assinatura para ler cupons.");
    const limit = account.scanLimit || 0;
    if ((usage.count || 0) >= limit)
      throw new HttpError(429, "Limite mensal de leituras atingido.");
    if ((global.count || 0) >= globalLimit)
      throw new HttpError(503, "Leitura temporariamente indisponível.");
    const minute = Math.floor(now / 60000);
    const burst = usage.minute === minute ? usage.minuteCount || 0 : 0;
    if (burst >= 5)
      throw new HttpError(429, "Aguarde um minuto antes de tentar novamente.");
    // Reserve BEFORE contacting the provider. Attempts consume quota even on provider failure.
    tx.set(usageRef, {
      count: (usage.count || 0) + 1,
      minute,
      minuteCount: burst + 1,
      updatedAt: Timestamp.fromMillis(now),
    });
    tx.set(globalRef, {
      count: (global.count || 0) + 1,
      updatedAt: Timestamp.fromMillis(now),
    });
  });
}
