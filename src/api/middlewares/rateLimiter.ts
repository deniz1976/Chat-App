import rateLimit, { Options } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const baseOptions: Partial<Options> = {
  windowMs: FIFTEEN_MINUTES,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
};

export const apiRateLimiter = rateLimit({
  ...baseOptions,
  limit: 1000,
});

export const loginRateLimiter = rateLimit({
  ...baseOptions,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many failed login attempts, please try again later.' },
});

export const registrationRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: 'Too many accounts created from this IP, please try again later.' },
});
