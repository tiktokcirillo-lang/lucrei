import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function services() {
  if (!getApps().length) {
    const credential = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
    initializeApp({
      credential: credential
        ? cert(JSON.parse(credential))
        : applicationDefault(),
      projectId:
        process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
  return { db: getFirestore(), auth: getAuth() };
}
export async function authenticate(req, recent = false) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new HttpError(401, "Entre novamente para continuar.");
  let user;
  try {
    user = await services().auth.verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, "Sessão inválida. Entre novamente.");
  }
  if (recent && (!user.auth_time || Date.now() / 1000 - user.auth_time > 300))
    throw new HttpError(
      401,
      "Confirme sua identidade novamente.",
      "REAUTH_REQUIRED",
    );
  return user;
}
export function endpoint(methods, handler) {
  return async (req, res) => {
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Request-ID", requestId);
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        throw new HttpError(405, "Método não permitido.");
      }
      const result = await handler(req, res);
      if (!res.headersSent) res.status(200).json(result);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      // Never log provider responses, user input, credentials, receipt images or tokens.
      console.error(
        JSON.stringify({
          event: "api_error",
          requestId,
          status,
          code: error instanceof HttpError ? error.code : "INTERNAL",
          durationMs: Date.now() - started,
        }),
      );
      if (!res.headersSent)
        res
          .status(status)
          .json({
            error:
              status === 500
                ? "Não foi possível concluir. Tente novamente."
                : error.message,
            code: error instanceof HttpError ? error.code : "INTERNAL",
            requestId,
          });
    }
  };
}
export function appOrigin() {
  const url = new URL(process.env.APP_URL || "http://localhost:5173");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new HttpError(503, "Configuração de publicação pendente.");
  return url.origin;
}
export async function accountLock(uid, operation, allowDeleting = false) {
  const { db } = services();
  const ref = db.doc(`accounts/${uid}`);
  const lock = randomUUID();
  const account = await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() || {};
    if (data.deleting && !allowDeleting)
      throw new HttpError(409, "Exclusão da conta em andamento.");
    if ((data.lockUntil?.toMillis() || 0) > Date.now())
      throw new HttpError(
        409,
        "Outra operação está em andamento. Tente novamente.",
      );
    tx.set(
      ref,
      { lock, lockUntil: Timestamp.fromMillis(Date.now() + 120000) },
      { merge: true },
    );
    return data;
  });
  try {
    return await operation(account, ref);
  } finally {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.data()?.lock === lock)
        tx.update(ref, { lock: null, lockUntil: Timestamp.fromMillis(0) });
    });
  }
}
export function integerEnv(name, fallback = 0) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new HttpError(503, `Configuração pendente: ${name}.`);
  return value;
}
