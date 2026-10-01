import { FieldPath } from "firebase-admin/firestore";
import { services } from "../server/platform.js";
import {
  validateIngredientDocument,
  validateProductDocument,
  validateUserDocument,
} from "../server/firestoreCompatibility.js";

const maximum = Number(process.env.COMPATIBILITY_MAX_DOCUMENTS || 100000);
if (!Number.isSafeInteger(maximum) || maximum < 1)
  throw new Error("COMPATIBILITY_MAX_DOCUMENTS deve ser um inteiro positivo.");
if (!process.env.FIREBASE_PROJECT_ID)
  throw new Error("Defina FIREBASE_PROJECT_ID para o ambiente de homologação.");

const { db } = services();
const findings = [];
let checked = 0;

async function scan(query, kind, validate) {
  let cursor;
  do {
    let pageQuery = query.orderBy(FieldPath.documentId()).limit(500);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    for (const document of page.docs) {
      checked += 1;
      if (checked > maximum)
        throw new Error(`Limite de segurança atingido (${maximum} documentos).`);
      const issues = validate(document.data());
      if (issues.length) findings.push({ path: document.ref.path, kind, issues });
    }
    cursor = page.docs.at(-1);
  } while (cursor);
}

await scan(db.collection("users"), "user", validateUserDocument);
await scan(db.collectionGroup("products"), "product", validateProductDocument);
await scan(db.collectionGroup("ingredients"), "ingredient", validateIngredientDocument);

console.log(JSON.stringify({ projectId: process.env.FIREBASE_PROJECT_ID, checked, incompatible: findings.length, findings }, null, 2));
if (findings.length) process.exitCode = 2;
