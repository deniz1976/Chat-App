import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { setupDatabase } from './infrastructure/database';
import { errorHandler } from './api/middlewares/errorHandler';
import { logger } from './utils/logger';
import { initializeWebSocket } from './websocket';
import { resetAllUserStatuses } from './infrastructure/realtime/presence';
import { setupApiRoutes } from './api/routes';

const app = express();
app.set('trust proxy', config.trustProxy);
let server: http.Server;

setupDatabase()
  .then(resetAllUserStatuses)
  .then(() => {
    logger.info('Database setup complete.');

    if (config.corsOrigins.length > 0) {
      app.use(cors({ origin: config.corsOrigins, credentials: true }));
    }
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", 'data:', ...(config.cloudflare.r2PublicBaseUrl ? [config.cloudflare.r2PublicBaseUrl] : [])],
        },
      },
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(express.static(path.join(__dirname, '..', 'public')));

    setupApiRoutes(app);

    app.use(errorHandler);

    server = http.createServer(app);

    initializeWebSocket(server);

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });

  })
  .catch((error) => {
    logger.error('Failed to start server:', { error });
    process.exit(1);
  });

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  }
}); 