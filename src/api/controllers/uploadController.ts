import { Request, Response } from 'express';
import { uploadService } from '../../container';
import { UploadKind } from '../../core/services/UploadService';

const handleUpload = (kind: UploadKind) => async (req: Request, res: Response): Promise<void> => {
    const stored = await uploadService.upload(req.user!.id, kind, req.file!);
    res.status(201).json({ message: `${kind} uploaded successfully`, ...stored });
};

export const uploadImage = handleUpload(UploadKind.IMAGE);
export const uploadAudio = handleUpload(UploadKind.AUDIO);
export const uploadFile = handleUpload(UploadKind.FILE);
