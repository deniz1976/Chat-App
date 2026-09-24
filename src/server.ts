import http from 'http';
import { assertServerConfig, config } from './config';
import { createApp } from './app';
import { sequelize, setupDatabase } from './infrastructure/database';
import { initializeWebSocket } from './api/websocket/server';
import { presenceService } from './container';
import { logger } from './utils/logger';

const SHUTDOWN_TIMEOUT_MS = 10000;

const start = async (): Promise<void> => {
  assertServerConfig();
  await setupDatabase();
  await presenceService.resetAll();

  const server = http.createServer(createApp());
  const wss = initializeWebSocket(server);

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down gracefully`);
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

    wss.clients.forEach(client => client.close(1001, 'Server shutting down'));
    wss.close();
    server.close(async () => {
      await sequelize.close();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });
};

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
