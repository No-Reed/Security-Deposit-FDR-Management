import pino from 'pino';
import { config } from './env';

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  ...(config.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
      }
    : {}),
  redact: {
    paths: ['password', 'passwordHash', 'currentPassword', 'newPassword', 'sessionId'],
    censor: '[REDACTED]',
  },
});
