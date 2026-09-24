import express from 'express';
import { login, register, refreshToken, logout } from '../controllers/authController';
import { validateLogin, validateRegistration } from '../validators/authValidator';
import { authenticate } from '../middlewares/auth';
import { loginRateLimiter, registrationRateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.post('/register', registrationRateLimiter, validateRegistration, register);
router.post('/login', loginRateLimiter, validateLogin, login);
router.post('/refresh-token', authenticate, refreshToken);
router.post('/logout', logout);

export default router; 