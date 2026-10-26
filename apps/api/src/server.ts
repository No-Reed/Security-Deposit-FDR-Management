import { createApp } from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { startMaturityJob } from './jobs/maturityCheck';

async function main() {
  const app = createApp();

  // Start the scheduled maturity check job
  startMaturityJob();

  const server = app.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        demo: config.DEMO_MODE,
      },
      `🚀 DepositDesk API running on port ${config.PORT}`
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server closed. Database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
