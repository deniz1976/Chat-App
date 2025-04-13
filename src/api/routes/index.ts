import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from '../docs/swagger';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import chatRoutes from './chatRoutes';
import messageRoutes from './messageRoutes';
import uploadRoutes from './uploadRoutes';

export const setupApiRoutes = (app: Express): void => {
  // API version prefix
  const API_PREFIX = '/api/v1';

  // Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  
  // Mount routes
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/chats`, chatRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);
  app.use(`${API_PREFIX}/upload`, uploadRoutes);

  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}; 