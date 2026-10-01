import { spawnSync } from 'node:child_process';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
 console.error('Inicie o emulador e defina FIRESTORE_EMULATOR_HOST=127.0.0.1:8080. Este teste não roda contra produção.');
 process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs','run','tests/firestore.rules.test.js'], {stdio:'inherit',env:process.env});
process.exit(result.status ?? 1);
