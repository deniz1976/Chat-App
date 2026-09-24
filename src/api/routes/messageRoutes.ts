import express from 'express';
import { validateUuidParams } from '../validators/paramValidator';
import {
  getMessages,
  getMessage,
  createMessage,
  updateMessage,
  deleteMessage,
  markAsRead,
  getUnreadCount,
  getMediaMessages,
  searchMessages,
} from '../controllers/messageController';
import { authenticate } from '../middlewares/auth';
import {
  validateMessageCreation,
  validateMessageListQuery,
  validateMessageUpdate,
} from '../validators/messageValidator';
import { validatePaginatedQuery } from '../validators/queryValidator';

const router = express.Router();

validateUuidParams(router, 'id', 'chatId');

router.use(authenticate);

router.get('/chat/:chatId', validateMessageListQuery, getMessages);
router.get('/chat/:chatId/unread', getUnreadCount);
router.get('/chat/:chatId/media', validatePaginatedQuery, getMediaMessages);
router.get('/chat/:chatId/search', validatePaginatedQuery, searchMessages);
router.get('/:id', getMessage);
router.post('/', validateMessageCreation, createMessage);
router.put('/:id', validateMessageUpdate, updateMessage);
router.delete('/:id', deleteMessage);
router.put('/:id/read', markAsRead);

export default router;
