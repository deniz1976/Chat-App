import type { MessageType } from '../api/types';

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

const MB = 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const DOCUMENT_TYPES = ['application/pdf', 'application/zip', 'text/plain'];

export const ACCEPTED_TYPES = [...IMAGE_TYPES, ...AUDIO_TYPES, ...VIDEO_TYPES, ...DOCUMENT_TYPES].join(',');

export const attachmentKind = (mimeType: string): AttachmentKind | null => {
  if (IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (AUDIO_TYPES.includes(mimeType)) {
    return 'audio';
  }
  if (VIDEO_TYPES.includes(mimeType)) {
    return 'video';
  }
  if (DOCUMENT_TYPES.includes(mimeType)) {
    return 'file';
  }
  return null;
};

export const maxBytesFor = (kind: AttachmentKind): number => (kind === 'image' ? 15 * MB : 25 * MB);

export const messageTypeFor = (kind: AttachmentKind): MessageType => kind;

export const validateAttachment = (file: File): string | null => {
  const kind = attachmentKind(file.type);
  if (!kind) {
    return 'This file type cannot be sent. Use an image, audio, video, PDF, ZIP or text file.';
  }
  if (file.size > maxBytesFor(kind)) {
    return `${kind === 'image' ? 'Images' : 'Files'} must be ${maxBytesFor(kind) / MB} MB or smaller.`;
  }
  return null;
};
