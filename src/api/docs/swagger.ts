import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Application API Documentation',
      version,
      description: 'API documentation for the Real-time Chat Application',
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
      contact: {
        name: 'API Support',
        email: 'support@chatapp.com',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/api/routes/*.ts', './src/api/controllers/*.ts', './src/domain/entities/*.ts'],
};

export const specs = swaggerJsdoc(options); 