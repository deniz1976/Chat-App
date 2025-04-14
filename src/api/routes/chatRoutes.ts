import express from 'express';
import { 
  getChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  addParticipant,
  removeParticipant,
  addAdmin,
  removeAdmin
} from '../controllers/chatController';
import { authenticate } from '../middlewares/auth';
import { validateChatCreation, validateChatUpdate } from '../validators/chatValidator';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

router.use(authenticate);

router.get('/', catchErrors(getChats));
router.get('/:id', catchErrors(getChat));
router.post('/', validateChatCreation, catchErrors(createChat));
router.put('/:id', validateChatUpdate, catchErrors(updateChat));
router.delete('/:id', catchErrors(deleteChat));

router.post('/:id/participants', catchErrors(addParticipant));
router.delete('/:id/participants/:userId', catchErrors(removeParticipant));
router.post('/:id/admins', catchErrors(addAdmin));
router.delete('/:id/admins/:userId', catchErrors(removeAdmin));

export default router; 