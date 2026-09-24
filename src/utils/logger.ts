import winston from 'winston';
import { config } from '../config';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

const serializeError = (error: Error): Record<string, unknown> => ({
  ...error,
  name: error.name,
  message: error.message,
  stack: error.stack,
});

const serializeErrors = winston.format((info) => {
  for (const key of Object.keys(info)) {
    const value = info[key];
    if (value instanceof Error) {
      info[key] = serializeError(value);
    }
  }
  return info;
});

const FORMATTED_KEYS = new Set(['level', 'message', 'timestamp']);

const formatMetadata = (info: winston.Logform.TransformableInfo): string => {
  const metadata = Object.fromEntries(
    Object.entries(info).filter(([key]) => !FORMATTED_KEYS.has(key)),
  );
  return Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
};

const formatConsole = winston.format.combine(
  serializeErrors(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ level: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${formatMetadata(info)}`,
  ),
);

const formatFile = winston.format.combine(
  serializeErrors(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

const level = config.logLevel;

export const logger = winston.createLogger({
  level,
  levels: logLevels,
  transports: [
    new winston.transports.Console({
      format: formatConsole,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: formatFile,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: formatFile,
    }),
  ],
}); 