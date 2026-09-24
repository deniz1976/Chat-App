import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileStorage, StoreFileInput } from '../../core/storage';

export interface R2Settings {
  accountId: string;
  r2BucketName: string;
  r2PublicBaseUrl: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
}

export class R2FileStorage implements FileStorage {
  private client: S3Client | null = null;

  constructor(private readonly settings: R2Settings) {}

  async store({ key, body, contentType, contentDisposition }: StoreFileInput): Promise<string> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.settings.r2BucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: contentDisposition,
      }),
    );
    return `${this.settings.r2PublicBaseUrl}/${key}`;
  }

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }
    const { accountId, r2BucketName, r2PublicBaseUrl, r2AccessKeyId, r2SecretAccessKey } = this.settings;
    if (!accountId || !r2BucketName || !r2PublicBaseUrl || !r2AccessKeyId || !r2SecretAccessKey) {
      throw new Error('R2 storage is not configured');
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
    });
    return this.client;
  }
}
