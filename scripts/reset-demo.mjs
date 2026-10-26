import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(`${root}/.env`)) process.loadEnvFile(`${root}/.env`);
const target = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/depositdesk');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(target.hostname)
  || target.pathname !== '/depositdesk') {
  throw new Error('Reset is restricted to the local depositdesk demo database outside production.');
}
if (!process.argv.includes('--confirm-local-demo-reset')) {
  throw new Error('This deletes local demo data. Run npm run db:reset -- --confirm-local-demo-reset to confirm.');
}
for (const args of [
  [`${root}/node_modules/prisma/build/index.js`, 'migrate', 'reset', '--force', '--skip-seed'],
  [`${root}/node_modules/tsx/dist/cli.mjs`, 'prisma/seed.ts'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, cwd: `${root}/apps/api` });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
