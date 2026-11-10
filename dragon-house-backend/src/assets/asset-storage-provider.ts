export interface AssetStorageProvider {
  readonly name: string;
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
