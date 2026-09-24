import dotenv from 'dotenv';
import { Dialect } from 'sequelize';

dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseList = (value?: string): string[] =>
  (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

const parseTrustProxy = (value?: string): boolean | number | string => {
  if (!value || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
};

const toHttpsBaseUrl = (hostname?: string): string => {
  const host = hostname?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return host ? `https://${host}` : '';
};

const MIN_JWT_SECRET_LENGTH = 32;

const loadJwtSecret = (): string => {
  const secret = requireEnv('JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }
  return secret;
};

export interface Config {
  port: number;
  nodeEnv: string;
  trustProxy: boolean | number | string;
  corsOrigins: string[];
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
    r2BucketName: string;
    r2PublicBaseUrl: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  corsOrigins: parseList(process.env.CORS_ORIGINS),
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
    secret: loadJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    r2BucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
    r2PublicBaseUrl: toHttpsBaseUrl(process.env.CLOUDFLARE_R2_PUBLIC_HOSTNAME),
    r2AccessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
}; 