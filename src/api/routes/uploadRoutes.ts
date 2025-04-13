import express from 'express';
import { uploadImage, uploadAudio, uploadFile } from '../controllers/uploadController';
import { authenticate } from '../middlewares/auth';
import { upload } from '../middlewares/multer';
import { catchErrors } from '../middlewares/errorHandler';

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Upload routes
router.post('/image', upload.single('file'), catchErrors(uploadImage));
router.post('/audio', upload.single('file'), catchErrors(uploadAudio));
router.post('/file', upload.single('file'), catchErrors(uploadFile));

export default router; 