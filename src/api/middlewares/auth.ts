import { Request, Response, NextFunction, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { config } from '../../config';
import { UserRole } from '../../domain/entities/User';
import { authService } from '../../container';

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

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const AUTH_COOKIE_NAME = 'access_token';

const authCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/',
});

export const generateToken = (userId: string, username: string, email: string): string => {
  return jwt.sign({ userId, username, email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
};

export const issueAuthCookie = (res: Response, user: { id: string; username: string; email: string }): void => {
  const token = generateToken(user.id, user.username, user.email);
  const { exp } = jwt.decode(token) as TokenPayload;
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: exp * 1000 - Date.now(),
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
};

export const getTokenFromCookieHeader = (cookieHeader?: string): string | undefined => {
  if (!cookieHeader) {
    return undefined;
  }
  return parseCookie(cookieHeader)[AUTH_COOKIE_NAME];
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

export const resolveUserFromToken = async (token: string): Promise<AuthenticatedUser | null> => {
  let decoded: TokenPayload;
  try {
    decoded = await verifyToken(token);
  } catch {
    return null;
  }

  const user = await authService.findUser(decoded.userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = getTokenFromCookieHeader(req.headers.cookie);

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const user = await resolveUserFromToken(token);

    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    req.user = user;
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
