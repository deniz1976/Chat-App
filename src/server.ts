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
import { setupApiRoutes } from './api/routes';
import rateLimit from 'express-rate-limit';

const app = express();
let server: http.Server;

setupDatabase()
  .then(() => {
    logger.info('Database setup complete.');

    app.use(cors());
    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, 
      max: 100, 
      standardHeaders: true, 
      legacyHeaders: false, 
    });
    app.use(limiter); 

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