import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../utils/logger';

interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
      };
    }
  }
}

export const generateToken = (userId: string, username: string, email: string): string => {
  const secret = config.jwt.secret;
  if (!secret) {
    logger.error('JWT secret is not defined in config.');
    throw new Error('JWT secret configuration error.');
  }

  return jwt.sign(
    { userId, username, email },
    secret as string,
    { expiresIn: 86400 }
  );
};

export const verifyToken = (token: string): Promise<TokenPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as TokenPayload);
      }
    });
  });
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
    };
    
    next();
  } catch (error: any) {
    logger.error('Authentication error', { error });
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
