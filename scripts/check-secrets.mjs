import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const excluded = new Set(["node_modules", ".git", "dist", ".vercel"]);
const patterns = [
  /[sr]k_(live|test)_[A-Za-z0-9]{16,}/,
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /sk-ant-api[A-Za-z0-9_-]{20,}/,
];
let found = false;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (entry.name.startsWith(".env") && entry.name !== ".env.example") {
      console.error(`Arquivo privado não deve ser enviado: ${path}`);
      found = true;
      continue;
    }
    if (!/\.(js|jsx|mjs|json|yml|yaml|txt|md)$/.test(entry.name)) continue;
    const text = await readFile(path, "utf8");
    if (patterns.some((p) => p.test(text))) {
      console.error(`Possível segredo em ${path}`);
      found = true;
    }
  }
}
await scan(".");
if (found) process.exit(1);
console.log("Nenhum padrão de segredo detectado nos arquivos verificados.");
