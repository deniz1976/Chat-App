import express from 'express';
import { 
  getMessages,
  getMessage,
  createMessage,
  updateMessage,
  deleteMessage,
  markAsRead,
  getUnreadCount,
  getMediaMessages,
  searchMessages
} from '../controllers/messageController';
import { authenticate } from '../middlewares/auth';
import { validateMessageCreation, validateMessageListQuery, validateMessageUpdate } from '../validators/messageValidator';
import { validatePaginatedQuery } from '../validators/queryValidator';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

router.use(authenticate);

router.get('/chat/:chatId', validateMessageListQuery, catchErrors(getMessages));
router.get('/chat/:chatId/unread', catchErrors(getUnreadCount));
router.get('/chat/:chatId/media', validatePaginatedQuery, catchErrors(getMediaMessages));
router.get('/chat/:chatId/search', validatePaginatedQuery, catchErrors(searchMessages));
router.get('/:id', catchErrors(getMessage));
router.post('/', validateMessageCreation, catchErrors(createMessage));
router.put('/:id', validateMessageUpdate, catchErrors(updateMessage));
router.delete('/:id', catchErrors(deleteMessage));
router.put('/:id/read', catchErrors(markAsRead));

export default router; 