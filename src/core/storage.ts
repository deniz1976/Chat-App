export interface StoreFileInput {
  key: string;
  body: Buffer;
  contentType: string;
  contentDisposition?: string;
}

export interface FileStorage {
  store(input: StoreFileInput): Promise<string>;
}
