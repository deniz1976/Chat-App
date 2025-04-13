import dotenv from 'dotenv';
import { Sequelize, Dialect } from 'sequelize';

// Load environment variables from .env file
dotenv.config();

// Export the interface
export interface Config {
  port: number;
  nodeEnv: string;
  db: {
    dialect: Dialect;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cloudflare: {
    accountId: string;
    apiToken: string;
    imagesApiToken: string;
    r2BucketName: string;
    r2PublicHostname: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    dialect: (process.env.DB_DIALECT as Dialect) || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chat_app',
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    imagesApiToken: process.env.CLOUDFLARE_IMAGES_TOKEN || '',
    r2BucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
    r2PublicHostname: process.env.CLOUDFLARE_R2_PUBLIC_HOSTNAME || '',
    r2AccessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
}; 