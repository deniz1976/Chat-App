import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { AppError } from '../../core/errors';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

const resolveClientError = (err: HttpError): { statusCode: number; message: string } | null => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message };
  }
  const statusCode = err.statusCode ?? err.status;
  if (err.expose && statusCode && statusCode >= 400 && statusCode < 500) {
    return { statusCode, message: err.message };
  }
  return null;
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ message: 'Not found' });
};

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const clientError = resolveClientError(err);
  if (clientError) {
    logger.warn(`${clientError.statusCode} - ${clientError.message}`, { url: req.originalUrl, method: req.method });
    res.status(clientError.statusCode).json({ message: clientError.message });
    return;
  }

  logger.error(`500 - ${err.message}`, { url: req.originalUrl, method: req.method, error: err });
  res.status(500).json({
    message: 'Something went wrong.',
    ...(config.nodeEnv === 'development' && { detail: err.message, stack: err.stack }),
  });
};
