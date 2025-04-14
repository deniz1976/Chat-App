import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import { config } from '../../config'; 
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../../utils/logger';

let s3Client: S3Client;
try {
    s3Client = new S3Client({
        region: 'auto', 
        endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.cloudflare.r2AccessKeyId, 
            secretAccessKey: config.cloudflare.r2SecretAccessKey, 
        },
    });
    logger.info('S3Client configured successfully for R2.');
} catch (error) {
    logger.error('Failed to configure S3Client for R2:', error);
    throw new Error('Could not initialize R2 storage client. Check credentials and configuration.');
}

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        logger.warn(`Invalid file type uploaded by user ${req.user?.id || 'unknown'}: ${file.mimetype}, ${file.originalname}`);
        cb(null, false);
    }
};

const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: config.cloudflare.r2BucketName, 
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE, 
        metadata: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, metadata?: any) => void) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, key?: string) => void) {
            
            const userId = (req as any).user?.id || 'unknown'; 
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const extension = path.extname(file.originalname);
            const generatedKey = `avatars/user-${userId}-${uniqueSuffix}${extension}`;
            logger.info(`Generating R2 key for user ${userId}: ${generatedKey}`);
            cb(null, generatedKey);
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: fileFilter 
});

const handleUpload = upload.single('file');

const uploadMiddleware: RequestHandler = (req, res, next) => {
    handleUpload(req, res, (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                logger.warn(`Multer error during avatar upload for user ${req.user?.id}: ${err.message}`, { code: err.code });
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            } else {
                logger.error(`Unknown error during avatar upload for user ${req.user?.id}: ${err.message}`, { error: err });
                if (err.message && (err.message.includes('Forbidden') || err.message.includes('Unauthorized') || err.message.includes('Access Denied'))) {
                    return res.status(403).json({ message: 'Storage access denied. Check R2 permissions.' });
                }
                return res.status(500).json({ message: 'Could not upload file due to an internal error.' });
            }
        } else {
            next();
        }
    });
};

export default uploadMiddleware; 