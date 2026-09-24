import express from 'express';
import { uploadImage, uploadAudio, uploadFile } from '../controllers/uploadController';
import { authenticate } from '../middlewares/auth';
import { singleFileUpload } from '../middlewares/upload';
import { UploadKind } from '../../core/services/UploadService';

const router = express.Router();

router.use(authenticate);

router.post('/image', singleFileUpload(UploadKind.IMAGE), uploadImage);
router.post('/audio', singleFileUpload(UploadKind.AUDIO), uploadAudio);
router.post('/file', singleFileUpload(UploadKind.FILE), uploadFile);

export default router;
