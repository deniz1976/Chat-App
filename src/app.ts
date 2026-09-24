import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler';
import { setupApiRoutes } from './api/routes';

export const createApp = (): Express => {
  const app = express();
  app.set('trust proxy', config.trustProxy);

  if (config.corsOrigins.length > 0) {
    app.use(cors({ origin: config.corsOrigins, credentials: true }));
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: [
            "'self'",
            'data:',
            ...(config.cloudflare.r2PublicBaseUrl ? [config.cloudflare.r2PublicBaseUrl] : []),
          ],
        },
      },
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));

  setupApiRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
