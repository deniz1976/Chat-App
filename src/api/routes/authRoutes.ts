import express from 'express';
import { login, register, refreshToken, logout } from '../controllers/authController';
import { validateLogin, validateRegistration } from '../validators/authValidator';
import { authenticate } from '../middlewares/auth';
import { catchErrors } from '../middlewares/errorHandler';
import { loginRateLimiter, registrationRateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.post('/register', registrationRateLimiter, validateRegistration, catchErrors(register));
router.post('/login', loginRateLimiter, validateLogin, catchErrors(login));
router.post('/refresh-token', authenticate, catchErrors(refreshToken));
router.post('/logout', catchErrors(logout));

export default router; 