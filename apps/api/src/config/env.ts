import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/depositdesk'),
  SESSION_SECRET: z.string().default('depositdesk-super-secret-key-at-least-64-characters-long-for-security-production-and-dev'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
  UPLOAD_DIR: z.string().default('./private-uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  DEMO_MODE: z.string().transform(v => v === 'true').default('true'),
  MATURITY_ALERT_DAYS: z.string().default('90,60,30,15,7,1'),
  ESCALATION_DAYS: z.coerce.number().default(7),
  ESCALATION_REPEAT_DAYS: z.coerce.number().default(3),
});

// Fail closed: refuse to start in production with bad config
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const placeholders = ['replace-with-a-long-random-secret', 'changeme', 'secret'];
    if (placeholders.some(p => env.SESSION_SECRET.toLowerCase().includes(p))) {
      console.error('❌ SESSION_SECRET is a known placeholder. Refusing to start in production.');
      process.exit(1);
    }
    if (env.DEMO_MODE) {
      console.error('❌ DEMO_MODE=true is not allowed in production. Refusing to start.');
      process.exit(1);
    }
  }

  return env;
}

export const config = loadEnv();

export const MATURITY_ALERT_DAYS = config.MATURITY_ALERT_DAYS
  .split(',')
  .map(d => parseInt(d.trim(), 10))
  .filter(d => !isNaN(d))
  .sort((a, b) => b - a);
