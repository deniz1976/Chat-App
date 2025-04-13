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
import { validateMessageCreation, validateMessageUpdate } from '../validators/messageValidator';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

// Message routes
router.get('/chat/:chatId', catchErrors(getMessages));
router.get('/chat/:chatId/unread', catchErrors(getUnreadCount));
router.get('/chat/:chatId/media', catchErrors(getMediaMessages));
router.get('/chat/:chatId/search', catchErrors(searchMessages));
router.get('/:id', catchErrors(getMessage));
router.post('/', validateMessageCreation, catchErrors(createMessage));
router.put('/:id', validateMessageUpdate, catchErrors(updateMessage));
router.delete('/:id', catchErrors(deleteMessage));
router.put('/:id/read', catchErrors(markAsRead));

export default router; 