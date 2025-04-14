import rateLimit from 'express-rate-limit';
import { config } from '../../config';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
  },
  skip: () => config.nodeEnv === 'development', 
}); 