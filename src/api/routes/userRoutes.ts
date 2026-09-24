import express from 'express';
import { validateUuidParams } from '../validators/paramValidator';
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
import { validatePaginatedQuery } from '../validators/queryValidator';
import uploadMiddleware from '../middlewares/upload';
import { UserRole } from '../../domain/entities/User';

const router = express.Router();

validateUuidParams(router, 'id');

router.use(authenticate);

router.get('/', validatePaginatedQuery, getUsers);
router.get('/search', validatePaginatedQuery, searchUsers);
router.get('/profile', getUserProfile);
router.put('/profile/avatar', uploadMiddleware, updateUserProfileAvatar);
router.get('/:id', getUser);
router.put('/:id', requireSelfOrAdmin(), validateUserUpdate, updateUser);
router.delete('/:id', requireSelfOrAdmin(), deleteUser);
router.put('/:id/status', validateUserStatus, updateStatus);
router.put('/:id/role', requireRole(UserRole.ADMIN), validateUserRole, updateRole);

export default router; 