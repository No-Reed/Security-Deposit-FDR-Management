import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(`${root}/.env`)) process.loadEnvFile(`${root}/.env`);
const raw = process.env.DATABASE_URL_TEST;
if (!raw) throw new Error('DATABASE_URL_TEST is required for integration tests.');
const target = new URL(raw);
const development = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/depositdesk');
if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(target.protocol)
  || !['localhost', '127.0.0.1'].includes(target.hostname)
  || target.pathname !== '/depositdesk_test'
  || (['localhost', '127.0.0.1'].includes(development.hostname)
    && (target.port || '5432') === (development.port || '5432') && target.pathname === development.pathname)) {
  throw new Error('Integration tests may reset only a separate local depositdesk_test database.');
}
const env = { ...process.env, DATABASE_URL: raw, NODE_ENV: 'test', DEMO_MODE: 'true' };
for (const args of [
  [`${root}/node_modules/prisma/build/index.js`, 'migrate', 'reset', '--force', '--skip-seed'],
  [`${root}/node_modules/vitest/vitest.mjs`, 'run', '--config', 'vitest.integration.config.ts', '--reporter', 'verbose'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', cwd: `${root}/apps/api` });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
