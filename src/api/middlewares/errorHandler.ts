import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { config } from '../../config';

interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

// For catching synchronous errors in routes
export const catchErrors = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};

// Global error handler middleware
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error
  logger.error(`${err.statusCode} - ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    stack: err.stack,
  });

  // Send different error response formats based on environment
  if (config.nodeEnv === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  } else {
    // For production, don't expose stack trace and error details
    res.status(err.statusCode).json({
      status: err.status,
      message: err.isOperational ? err.message : 'Something went wrong.',
    });
  }
}; 