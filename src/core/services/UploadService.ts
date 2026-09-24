import { randomUUID } from 'crypto';
import { FileStorage } from '../storage';
import { BadRequestError } from '../errors';
import { matchesImageSignature } from '../../utils/fileSignature';

export enum UploadKind {
  AVATAR = 'avatar',
  IMAGE = 'image',
  AUDIO = 'audio',
  FILE = 'file',
}

export interface UploadPolicy {
  maxBytes: number;
  extensions: Record<string, string>;
  requireImageSignature: boolean;
  downloadAsAttachment: boolean;
}

export interface IncomingFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface StoredFile {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

const MB = 1024 * 1024;

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const AUDIO_EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
};

export const UPLOAD_POLICIES: Record<UploadKind, UploadPolicy> = {
  [UploadKind.AVATAR]: {
    maxBytes: 15 * MB,
    extensions: IMAGE_EXTENSIONS,
    requireImageSignature: true,
    downloadAsAttachment: false,
  },
  [UploadKind.IMAGE]: {
    maxBytes: 15 * MB,
    extensions: IMAGE_EXTENSIONS,
    requireImageSignature: true,
    downloadAsAttachment: false,
  },
  [UploadKind.AUDIO]: {
    maxBytes: 25 * MB,
    extensions: AUDIO_EXTENSIONS,
    requireImageSignature: false,
    downloadAsAttachment: false,
  },
  [UploadKind.FILE]: {
    maxBytes: 25 * MB,
    extensions: {
      ...IMAGE_EXTENSIONS,
      ...AUDIO_EXTENSIONS,
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'text/plain': 'txt',
    },
    requireImageSignature: false,
    downloadAsAttachment: true,
  },
};

const isPrintable = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f && character !== '"';
};

const sanitizeFilename = (filename: string): string =>
  [...filename.replace(/[\\/]/g, '_')].filter(isPrintable).join('').trim().slice(0, 200) || 'file';

export class UploadService {
  constructor(private readonly storage: FileStorage) {}

  async upload(userId: string, kind: UploadKind, file: IncomingFile): Promise<StoredFile> {
    const policy = UPLOAD_POLICIES[kind];
    const extension = policy.extensions[file.mimetype];

    if (!extension) {
      throw new BadRequestError('File type not supported');
    }
    if (file.size > policy.maxBytes) {
      throw new BadRequestError('File is too large');
    }
    if (policy.requireImageSignature && !matchesImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestError('File content does not match its declared image type');
    }

    const filename = sanitizeFilename(file.originalname);
    const url = await this.storage.store({
      key: `${kind}/${userId}/${randomUUID()}.${extension}`,
      body: file.buffer,
      contentType: file.mimetype,
      contentDisposition: policy.downloadAsAttachment
        ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
        : undefined,
    });

    return { url, filename, mimetype: file.mimetype, size: file.size };
  }
}
