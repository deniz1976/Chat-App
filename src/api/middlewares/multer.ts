import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Define file storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
  const allowedFileTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedAudioTypes, 'application/pdf', 'text/plain', 'application/zip'];

  // Check if the file type is allowed
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
}); 