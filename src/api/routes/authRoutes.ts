import express from 'express';
import { login, register, refreshToken, logout } from '../controllers/authController';
import { validateLogin, validateRegistration } from '../validators/authValidator';
import { authenticate } from '../middlewares/auth';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

router.post('/register', validateRegistration, catchErrors(register));
router.post('/login', validateLogin, catchErrors(login));
router.post('/refresh-token', catchErrors(refreshToken));
router.post('/logout', authenticate, catchErrors(logout));

export default router; 