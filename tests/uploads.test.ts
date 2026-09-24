import { UploadKind, UploadService } from '../src/core/services/UploadService';
import { StoreFileInput } from '../src/core/storage';
import { createUser, setupTestDatabase } from './helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe('UploadService', () => {
  const stored: StoreFileInput[] = [];
  const service = new UploadService({
    store: async (input) => {
      stored.push(input);
      return `https://cdn.example.com/${input.key}`;
    },
  });

  beforeEach(() => {
    stored.length = 0;
  });

  it('stores images under a generated key with an extension derived from the type', async () => {
    const result = await service.upload('user-1', UploadKind.IMAGE, {
      buffer: PNG, mimetype: 'image/png', originalname: '../../etc/passwd.png', size: PNG.length,
    });

    expect(stored[0].key).toMatch(/^image\/user-1\/[0-9a-f-]{36}\.png$/);
    expect(stored[0].contentDisposition).toBeUndefined();
    expect(result.url).toBe(`https://cdn.example.com/${stored[0].key}`);
    expect(result.filename).toBe('.._.._etc_passwd.png');
  });

  it('rejects images whose content does not match the declared type', async () => {
    await expect(service.upload('user-1', UploadKind.IMAGE, {
      buffer: Buffer.from('<svg onload=alert(1)>'), mimetype: 'image/png', originalname: 'x.png', size: 21,
    })).rejects.toThrow('File content does not match its declared image type');
    expect(stored).toHaveLength(0);
  });

  it('rejects unsupported types and oversized files', async () => {
    await expect(service.upload('user-1', UploadKind.FILE, {
      buffer: Buffer.from('<html>'), mimetype: 'text/html', originalname: 'x.html', size: 6,
    })).rejects.toThrow('File type not supported');
    await expect(service.upload('user-1', UploadKind.AVATAR, {
      buffer: PNG, mimetype: 'image/png', originalname: 'x.png', size: 16 * 1024 * 1024,
    })).rejects.toThrow('File is too large');
  });

  it('stores generic files as attachments with an encoded filename', async () => {
    await service.upload('user-1', UploadKind.FILE, {
      buffer: Buffer.from('%PDF'), mimetype: 'application/pdf', originalname: 'report "final".pdf', size: 4,
    });
    expect(stored[0].contentDisposition).toBe("attachment; filename*=UTF-8''report%20final.pdf");
  });
});

describe('upload endpoints', () => {
  setupTestDatabase();

  it('validates files before they reach storage', async () => {
    const alice = await createUser('alice');

    await alice.post('/upload/image').expect(400, { message: 'No file uploaded' });
    await alice.post('/upload/file').attach('file', Buffer.from('<html>'), { filename: 'a.html', contentType: 'text/html' })
      .expect(400, { message: 'File type not supported' });
    await alice.post('/upload/image').attach('file', Buffer.from('<svg>'), { filename: 'a.png', contentType: 'image/png' })
      .expect(400, { message: 'File content does not match its declared image type' });
    await alice.post('/upload/image').attach('file', Buffer.alloc(16 * 1024 * 1024), { filename: 'a.png', contentType: 'image/png' })
      .expect(400, { message: 'File is too large' });
    await alice.put('/users/profile/avatar').attach('file', Buffer.from('<svg>'), { filename: 'a.png', contentType: 'image/png' })
      .expect(400);
  });
});
