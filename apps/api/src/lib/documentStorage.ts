import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

// Financial documents remain private. Another storage provider can implement this
// boundary without introducing public object URLs into API responses.
export interface DocumentStorage {
  directory: string;
  remove(key: string): Promise<void>;
}

export const privateStorage: DocumentStorage = {
  directory: path.resolve(config.UPLOAD_DIR),
  async remove(key) {
    const location = path.resolve(this.directory, key);
    if (path.dirname(location) !== this.directory)
      throw new Error('Invalid storage key');
    await fs.promises.unlink(location);
  },
};

export interface DocumentScanner {
  scan(filePath: string): Promise<'NOT_SCANNED' | 'CLEAN' | 'INFECTED'>;
}

// Deliberately unconfigured. The API and UI must never report this as scanned.
export const documentScanner: DocumentScanner = {
  async scan(_filePath) {
    return 'NOT_SCANNED';
  },
};
