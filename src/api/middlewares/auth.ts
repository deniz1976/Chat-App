import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { User, UserRole } from '../../domain/entities/User';

interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const generateToken = (userId: string, username: string, email: string): string => {
  return jwt.sign(
    { userId, username, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  let decoded: TokenPayload;
  try {
    decoded = await verifyToken(authHeader.split(' ')[1]);
  } catch (error: any) {
    logger.warn('Authentication failed: invalid or expired token', { reason: error?.message });
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  try {
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'role'],
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const isAdmin = (user?: AuthenticatedUser): boolean => user?.role === UserRole.ADMIN;

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
};

export const requireSelfOrAdmin = (paramName = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    if (req.user.id !== req.params[paramName] && !isAdmin(req.user)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
};
