import { Request, Response } from 'express';
import { authService } from '../../container';
import { clearAuthCookie, issueAuthCookie } from '../middlewares/auth';
import { toPrivateUser } from '../presenters/userPresenter';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - displayName
 *             properties:
 *               username:
 *                 type: string
 *                 description: User's unique username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password (min 6 characters)
 *               displayName:
 *                 type: string
 *                 description: User's display name
 *               profileImage:
 *                 type: string
 *                 format: uri
 *                 description: URL to user's profile image
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     displayName:
 *                       type: string
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Server error
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const user = await authService.register(req.body);
  issueAuthCookie(res, user);
  res.status(201).json({ user: toPrivateUser(user) });
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to the application
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const user = await authService.login(req.body.email, req.body.password);
  issueAuthCookie(res, user);
  res.status(200).json({ user: toPrivateUser(user) });
};

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Session cookie refreshed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  issueAuthCookie(res, req.user!);
  res.status(200).json({ message: 'Session refreshed' });
};

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout from the application
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Server error
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
};
