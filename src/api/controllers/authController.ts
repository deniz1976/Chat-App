import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User, UserCreationAttributes } from '../../domain/entities/User';
import { generateToken } from '../middlewares/auth';
import { logger } from '../../utils/logger';

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
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Server error
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, displayName, profileImage } = req.body;
    
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({ message: 'Username or email already exists' });
      return;
    }

    const userData: UserCreationAttributes = {
      username,
      email,
      password,
      displayName,
      profileImage,
    };

    const user = await User.create(userData);
    
    const token = generateToken(user.id, user.username, user.email);

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      profileImage: user.profileImage,
      status: user.status,
    };

    res.status(201).json({
      user: userResponse,
      token,
    });
  } catch (error: any) {
    logger.error('Registration error', { error });
    res.status(500).json({ message: 'Failed to register user' });
  }
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
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();
    
    const token = generateToken(user.id, user.username, user.email);
    
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      profileImage: user.profileImage,
      status: user.status,
    };
    
    res.status(200).json({
      user: userResponse,
      token,
    });
  } catch (error: any) {
    logger.error('Login error', { error });
    res.status(500).json({ message: 'Failed to login' });
  }
};

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, username, email } = req.user!;
    
    const token = generateToken(id, username, email);
    
    res.status(200).json({ token });
  } catch (error: any) {
    logger.error('Token refresh error', { error });
    res.status(500).json({ message: 'Failed to refresh token' });
  }
};

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout from the application
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.user!;
    
    const user = await User.findByPk(id);
    
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date();
      await user.save();
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error('Logout error', { error });
    res.status(500).json({ message: 'Failed to logout' });
  }
}; 