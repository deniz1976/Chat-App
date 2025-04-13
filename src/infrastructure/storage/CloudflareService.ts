import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

interface UploadResponse {
  success: boolean;
  result?: {
    id: string;
    url: string;
  };
  error?: string;
}

export class CloudflareService {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly streamingApiToken: string | undefined;
  private readonly imagesApiToken: string;

  constructor() {
    this.accountId = config.cloudflare.accountId;
    this.apiToken = config.cloudflare.apiToken;
    //this.streamingApiToken = config.cloudflare.streamingApiToken;
    this.imagesApiToken = config.cloudflare.imagesApiToken;
  }

  public async uploadMedia(
    buffer: Buffer,
    fileName: string,
    mediaType: MediaType,
    contentType: string,
  ): Promise<string> {
    try {
      switch (mediaType) {
        case MediaType.IMAGE:
          return await this.uploadImage(buffer, fileName, contentType);
        case MediaType.VIDEO:
          return await this.uploadVideo(buffer, fileName, contentType);
        case MediaType.AUDIO:
          return await this.uploadAudio(buffer, fileName, contentType);
        case MediaType.FILE:
          return await this.uploadFile(buffer, fileName, contentType);
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }
    } catch (error: any) {
      logger.error('Error uploading media to Cloudflare', { error, mediaType, fileName });
      throw new Error(`Failed to upload ${mediaType}: ${error.message}`);
    }
  }

  private async uploadImage(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: fileName,
      contentType,
    });

    const response = await axios.post<UploadResponse>(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.imagesApiToken}`,
        },
      },
    );

    if (!response.data.success || !response.data.result) {
      throw new Error(response.data.error || 'Unknown error during image upload');
    }

    return response.data.result.url;
  }

  private async uploadVideo(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const stream = Readable.from(buffer);

    const formData = new FormData();
    formData.append('file', stream, {
      filename: fileName,
      contentType,
    });

    const response = await axios.post<UploadResponse>(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.streamingApiToken}`,
        },
      },
    );

    if (!response.data.success || !response.data.result) {
      throw new Error(response.data.error || 'Unknown error during video upload');
    }

    return `https://watch.cloudflarestream.com/${response.data.result.id}`;
  }

  private async uploadAudio(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    return this.uploadVideo(buffer, fileName, contentType);
  }

  private async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
   
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: fileName,
      contentType,
    });

    const response = await axios.post<UploadResponse>(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiToken}`,
        },
      },
    );

    if (!response.data.success || !response.data.result) {
      throw new Error(response.data.error || 'Unknown error during file upload');
    }

    return response.data.result.url;
  }
} 