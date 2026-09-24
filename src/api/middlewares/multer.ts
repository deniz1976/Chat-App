import multer from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
  const allowedFileTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedAudioTypes, 'application/pdf', 'text/plain', 'application/zip'];

  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
}); 