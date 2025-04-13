import express from 'express';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser, 
  updateStatus,
  searchUsers,
  getUserProfile
} from '../controllers/userController';
import { authenticate } from '../middlewares/auth';
import { validateUserUpdate } from '../validators/userValidator';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// User routes
router.get('/', catchErrors(getUsers));
router.get('/search', catchErrors(searchUsers));
router.get('/profile', catchErrors(getUserProfile));
router.get('/:id', catchErrors(getUser));
router.put('/:id', validateUserUpdate, catchErrors(updateUser));
router.delete('/:id', catchErrors(deleteUser));
router.put('/:id/status', catchErrors(updateStatus));

export default router; 