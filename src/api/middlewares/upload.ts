import multer from 'multer';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { BadRequestError } from '../../core/errors';
import { UPLOAD_POLICIES, UploadKind } from '../../core/services/UploadService';

const FILE_FIELD = 'file';

export const singleFileUpload = (kind: UploadKind): RequestHandler => {
  const policy = UPLOAD_POLICIES[kind];
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: policy.maxBytes, files: 1 },
    fileFilter: (req, file, callback) => {
      if (policy.extensions[file.mimetype]) {
        callback(null, true);
      } else {
        callback(new BadRequestError('File type not supported'));
      }
    },
  }).single(FILE_FIELD);

  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(new BadRequestError(error.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : error.message));
        return;
      }
      if (!error && !req.file) {
        next(new BadRequestError('No file uploaded'));
        return;
      }
      next(error);
    });
  };
};
