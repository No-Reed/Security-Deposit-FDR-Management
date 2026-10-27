import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(`${root}/.env`)) process.loadEnvFile(`${root}/.env`);
const [modulePath, ...args] = process.argv.slice(2);
if (!modulePath) throw new Error('A workspace CLI module is required');

const candidates = [
  `${root}/node_modules/${modulePath}`,
  `${root}/apps/api/node_modules/${modulePath}`,
];
const target = candidates.find(p => existsSync(p)) || candidates[0];

const result = spawnSync(process.execPath, [target, ...args], {
  stdio: 'inherit', env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
