import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import axios from 'axios';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.cloudflare.r2AccessKeyId,
        secretAccessKey: config.cloudflare.r2SecretAccessKey,
    }
});

const uploadToCloudflareImages = async (fileBuffer: Buffer, filename: string, mimetype: string): Promise<string | null> => {
    const accountId = config.cloudflare.accountId;
    const apiToken = config.cloudflare.imagesApiToken;

    if (!accountId || !apiToken) {
        logger.error('Cloudflare Images account ID or API token is missing in config');
        return null;
    }

    const formData = new FormData();
    formData.append('file', fileBuffer, { filename: filename, contentType: mimetype });

    try {
        const response = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiToken}`,
            }
        });

        const result = response.data;
        if (result.success && result.result.variants && result.result.variants.length > 0) {
            return result.result.variants[0];
        }
        logger.error('Cloudflare Images upload response missing success or variants', { result });
        return null;
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            logger.error('Axios error uploading to Cloudflare Images', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        } else {
            logger.error('Error uploading to Cloudflare Images', { error: error.message });
        }
        return null;
    }
};

const uploadToR2 = async (fileBuffer: Buffer, mimetype: string, fileKey: string): Promise<string | null> => {
    const bucketName = config.cloudflare.r2BucketName;
    const publicHostname = config.cloudflare.r2PublicHostname;

    const cleanPublicHostname = publicHostname.replace(/^https?:\/\//, '');

    if (!bucketName || !cleanPublicHostname) {
        logger.error('R2 bucket name or public hostname is missing or invalid in config');
        return null;
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mimetype,
        ACL: 'public-read'
    });

    try {
        await s3Client.send(command);
        const fileUrl = `https://${cleanPublicHostname}/${fileKey}`;
        return fileUrl;
    } catch (error: any) {
        logger.error('Error uploading to R2', { error: error.message, bucket: bucketName, key: fileKey });
        return null;
    }
};

const handleFileUpload = async (req: Request, res: Response, fileType: 'image' | 'audio' | 'file') => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const userId = req.user!.id;
    const file = req.file;
    let storageUrl: string | null = null;
    const fileKey = `${fileType}/${userId}/${randomUUID()}-${file.originalname}`;

    logger.info(`Received ${fileType} upload request from user ${userId}`, { filename: file.originalname, size: file.size, mimetype: file.mimetype });

    try {
        storageUrl = await uploadToR2(file.buffer, file.mimetype, fileKey);

        if (!storageUrl) {
            return res.status(500).json({ message: `Failed to upload ${fileType} to storage` });
        }

        res.status(201).json({
            message: `${fileType} uploaded successfully`,
            url: storageUrl,
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

    } catch (error: any) {
        logger.error(`Unexpected error during ${fileType} upload for user ${userId}`, { error: error.message, filename: file.originalname });
        res.status(500).json({ message: `Failed to upload ${fileType}` });
    }
};

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
    await handleFileUpload(req, res, 'image');
};

export const uploadAudio = async (req: Request, res: Response): Promise<void> => {
    await handleFileUpload(req, res, 'audio');
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
    await handleFileUpload(req, res, 'file');
};
