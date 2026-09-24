const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length && bytes.every((byte, index) => buffer[offset + index] === byte);

const imageSignatures: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': buffer => startsWith(buffer, [0xff, 0xd8, 0xff]),
  'image/png': buffer => startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': buffer => startsWith(buffer, [0x47, 0x49, 0x46, 0x38]),
  'image/webp': buffer => startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8),
};

export const matchesImageSignature = (buffer: Buffer, mimeType: string): boolean =>
  imageSignatures[mimeType]?.(buffer) ?? false;
