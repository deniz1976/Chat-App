import express from 'express';
import { validateUuidParams } from '../validators/paramValidator';
import {
  getChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  addParticipant,
  removeParticipant,
  addAdmin,
  removeAdmin,
  leaveChat,
} from '../controllers/chatController';
import { authenticate } from '../middlewares/auth';
import { validateChatCreation, validateChatUpdate, validateParticipant } from '../validators/chatValidator';

const router = express.Router();

validateUuidParams(router, 'id', 'userId');

router.use(authenticate);

router.get('/', getChats);
router.get('/:id', getChat);
router.post('/', validateChatCreation, createChat);
router.put('/:id', validateChatUpdate, updateChat);
router.delete('/:id', deleteChat);

router.post('/:id/participants', validateParticipant, addParticipant);
router.delete('/:id/participants/:userId', removeParticipant);
router.post('/:id/leave', leaveChat);
router.post('/:id/admins', validateParticipant, addAdmin);
router.delete('/:id/admins/:userId', removeAdmin);

export default router;
