import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initDatabasePool, checkDatabaseHealth, pool } from './config/database';

const app = createApp();

// Initialize MySQL pool
initDatabasePool();

const server = app.listen(env.PORT, async () => {
  logger.info(`================================================================`);
  logger.info(`  ${env.APP_NAME} (${env.API_VERSION})`);
  logger.info(`  Environment: ${env.NODE_ENV}`);
  logger.info(`  Server listening on: ${env.APP_URL}`);
  logger.info(`  API Base URL: ${env.APP_URL}${env.API_PREFIX}`);
  logger.info(`  API Documentation: ${env.APP_URL}/docs`);
  logger.info(`================================================================`);

  // Verify database connectivity
  const isHealthy = await checkDatabaseHealth();
  if (isHealthy) {
    logger.info(`✅ Database connection verified: MySQL 8+ (${env.DB_NAME})`);
  } else {
    logger.warn(`⚠️ Warning: Could not connect to MySQL database (${env.DB_NAME}). Check DB credentials.`);
  }
});

// Graceful Shutdown Handler
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed. Terminating database connections...');
    try {
      if (pool) {
        await pool.end();
        logger.info('MySQL connection pool successfully closed.');
      }
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown if connections do not close in 10s
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing termination.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
