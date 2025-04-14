import express from 'express';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser, 
  updateStatus,
  searchUsers,
  getUserProfile,
  updateUserProfileAvatar
} from '../controllers/userController';
import { authenticate } from '../middlewares/auth';
import { validateUserUpdate } from '../validators/userValidator';
import { catchErrors } from '../middlewares/errorHandler';
import uploadMiddleware from '../middlewares/upload';

const router = express.Router();

router.use(authenticate);

router.get('/', catchErrors(getUsers));
router.get('/search', catchErrors(searchUsers));
router.get('/profile', catchErrors(getUserProfile));
router.put('/profile/avatar', uploadMiddleware, catchErrors(updateUserProfileAvatar));
router.get('/:id', catchErrors(getUser));
router.put('/:id', validateUserUpdate, catchErrors(updateUser));
router.delete('/:id', catchErrors(deleteUser));
router.put('/:id/status', catchErrors(updateStatus));

export default router; 