import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { AssetStorageProvider } from './asset-storage-provider.js';

export class FilesystemAssetStorageProvider implements AssetStorageProvider {
  readonly name = 'filesystem';
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    if (!/^[a-f0-9]{2}\/[a-f0-9-]{36}\.(png|jpg|webp)$/u.test(key)) throw new Error('Invalid asset storage key');
    const target = path.resolve(this.root, ...key.split('/'));
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`))
      throw new Error('Asset path escapes storage root');
    return target;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }
  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
