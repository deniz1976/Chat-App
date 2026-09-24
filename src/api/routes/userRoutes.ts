import express from 'express';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser, 
  updateStatus,
  searchUsers,
  getUserProfile,
  updateUserProfileAvatar,
  updateRole
} from '../controllers/userController';
import { authenticate, requireRole, requireSelfOrAdmin } from '../middlewares/auth';
import { validateUserRole, validateUserStatus, validateUserUpdate } from '../validators/userValidator';
import { catchErrors } from '../middlewares/errorHandler';
import uploadMiddleware from '../middlewares/upload';
import { UserRole } from '../../domain/entities/User';

const router = express.Router();

router.use(authenticate);

router.get('/', catchErrors(getUsers));
router.get('/search', catchErrors(searchUsers));
router.get('/profile', catchErrors(getUserProfile));
router.put('/profile/avatar', uploadMiddleware, catchErrors(updateUserProfileAvatar));
router.get('/:id', catchErrors(getUser));
router.put('/:id', requireSelfOrAdmin(), validateUserUpdate, catchErrors(updateUser));
router.delete('/:id', requireSelfOrAdmin(), catchErrors(deleteUser));
router.put('/:id/status', validateUserStatus, catchErrors(updateStatus));
router.put('/:id/role', requireRole(UserRole.ADMIN), validateUserRole, catchErrors(updateRole));

export default router; 