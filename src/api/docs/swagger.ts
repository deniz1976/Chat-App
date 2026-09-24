import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const sourceRoot = path.resolve(__dirname, '..', '..');

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
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: [path.join(sourceRoot, 'api', 'controllers', '*.{ts,js}')],
};

export const specs = swaggerJsdoc(options);
