import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Synthetic demo seed boundary', () => {
  it('refuses production before connecting or changing data', () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(__dirname, '../../../../node_modules/tsx/dist/cli.mjs'),
        resolve(__dirname, '../../prisma/seed.ts'),
      ],
      {
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DEMO_MODE: 'false',
          SESSION_SECRET: 'a'.repeat(96),
          DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/do_not_connect',
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Seed script refuses to run in NODE_ENV=production',
    );
  });
});
