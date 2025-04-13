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

const formatConsole = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const formatFile = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

const level = config.nodeEnv === 'production' ? 'info' : 'debug';

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