import express from 'express';
import { uploadImage, uploadAudio, uploadFile } from '../controllers/uploadController';
import { authenticate } from '../middlewares/auth';
import { upload } from '../middlewares/multer';

const router = express.Router();

router.use(authenticate);

router.post('/image', upload.single('file'), uploadImage);
router.post('/audio', upload.single('file'), uploadAudio);
router.post('/file', upload.single('file'), uploadFile);

export default router; 