import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolveDataDir } from './data-path';
import { logger } from '../logging';

export interface DataStore<T> {
  data: Record<string, T>;
  lastModified: number;
  version: string;
}

export class JSONStore<T> {
  private filePath: string;
  private cache: DataStore<T> | null = null;
  private readonly version = '2.0.0'; // Updated version for improved locking
  private lockPath: string;
  private lockHeld: boolean = false;
  private operationQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;

  constructor(filename: string, dataDir?: string) {
    const baseDir = resolveDataDir(dataDir);
    this.filePath = path.join(baseDir, `${filename}.json`);
    this.lockPath = `${this.filePath}.lock`;
    logger.debug('Created JSON store', { filename, filePath: this.filePath });
  }

  async load(): Promise<DataStore<T>> {
    logger.debug('Loading JSON store', { filePath: this.filePath });

    // Check if we have a valid cached version
    if (this.cache) {
      try {
        const stat = await fs.stat(this.filePath);
        // Only use cache if file hasn't been modified and cache is recent
        if (this.cache.lastModified >= stat.mtimeMs &&
            (Date.now() - this.cache.lastModified) < 5000) { // 5 second cache validity
          logger.debug('Using cached JSON store data', { filePath: this.filePath });
          return { ...this.cache }; // Return copy to prevent external mutations
        }
      } catch (e) {
        logger.debug('JSON store stat failed', { filePath: this.filePath, error: e instanceof Error ? e.message : String(e) });
      }
      // If stat fails (file missing), fall through to reinitialize
    }
    
    try {
      logger.debug('Reading JSON store file', { filePath: this.filePath });
      const content = await fs.readFile(this.filePath, 'utf-8');
      logger.debug('Loaded JSON store content', { filePath: this.filePath, bytes: content.length });
      // Use JSON reviver to handle Date objects properly
      this.cache = JSON.parse(content, (key, value) => {
        // Check if the value looks like an ISO date string
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
          return new Date(value);
        }
        return value;
      });
      // Migration logic can go here if needed
      if (!this.cache?.version) {
        this.cache = { 
          data: this.cache?.data || {}, 
          lastModified: Date.now(), 
          version: this.version 
        };
      }
      logger.debug('Successfully parsed JSON store', {
        filePath: this.filePath,
        itemsCount: Object.keys(this.cache.data || {}).length
      });
    } catch (e) {
      logger.warn('Failed to read/parse JSON store', {
        filePath: this.filePath,
        error: e instanceof Error ? e.message : String(e)
      });
      this.cache = { data: {}, lastModified: Date.now(), version: this.version };
      logger.info('Initialized empty JSON store', { filePath: this.filePath });
    }
    
    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;

    logger.debug('Saving JSON store', { filePath: this.filePath });
    this.cache.lastModified = Date.now();
    try {
      await this.acquireLock();
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      // Use JSON replacer to handle Date objects properly
      const data = JSON.stringify(this.cache, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }, 2);
      logger.debug('Serializing JSON store data', { filePath: this.filePath, bytes: data.length });
      const tmpPath = `${this.filePath}.tmp`;
      await fs.writeFile(tmpPath, data, 'utf-8');
      await fs.rename(tmpPath, this.filePath);
      logger.debug('Successfully saved JSON store', { filePath: this.filePath });
    } catch (error) {
      logger.error('Failed to save JSON store', { filePath: this.filePath, error: error as Error });
      throw error;
    } finally {
      await this.releaseLock();
    }
  }

  async create(item: T): Promise<string> {
    const store = await this.load();
    const id = this.generateId();
    store.data[id] = item;
    await this.save();
    // Clear cache to ensure fresh reads
    this.cache = null;
    return id;
  }

  async upsert(id: string, item: T): Promise<void> {
    return this.queueOperation(async () => {
      const store = await this.load();
      store.data[id] = item;
      await this.save();
      // Clear cache to ensure fresh reads
      this.cache = null;
    });
  }

  async findById(id: string): Promise<T | null> {
    const store = await this.load();
    return store.data[id] || null;
  }

  async findMany(filter?: (item: T & { id: string }) => boolean): Promise<Array<T & { id: string }>> {
    const store = await this.load();
    const items = Object.entries(store.data).map(([id, item]) => ({ ...item, id }));
    
    if (filter) {
      return items.filter(filter);
    }
    
    return items;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const store = await this.load();
    const existing = store.data[id];

    if (!existing) return null;

    store.data[id] = { ...existing, ...updates };
    await this.save();
    // Clear cache to ensure fresh reads
    this.cache = null;

    return store.data[id] || null;
  }

  async delete(id: string): Promise<boolean> {
    const store = await this.load();
    if (!(id in store.data)) return false;

    delete store.data[id];
    await this.save();
    // Clear cache to ensure fresh reads
    this.cache = null;

    return true;
  }

  async count(filter?: (item: T & { id: string }) => boolean): Promise<number> {
    const items = await this.findMany(filter);
    return items.length;
  }

  async clear(): Promise<void> {
    const store = await this.load();
    store.data = {};
    await this.save();
    // Clear cache to ensure fresh reads
    this.cache = null;
  }

  private generateId(): string {
    return crypto.createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-${process.hrtime.bigint()}`)
      .digest('hex')
      .substring(0, 16);
  }

  // Queue operations to prevent race conditions
  private async queueOperation(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          await operation();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  // Process queued operations sequentially
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error(`[json-store] Error processing queued operation:`, error);
          // Continue processing other operations even if one fails
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // Execute multiple mutations within a single critical section guarded by a file lock.
  // Ensures all changes are written with one atomic rename.
  async mutate(mutator: (store: DataStore<T>) => void | Promise<void>): Promise<void> {
    return this.queueOperation(async () => {
      try {
        await this.acquireLock();
        // Force fresh read from disk while lock is held to avoid stale cache
        this.cache = null;
        const store = await this.load();
        await mutator(store);
        // Save while lock is still held
        store.lastModified = Date.now();
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const data = JSON.stringify(store, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2);
        const tmpPath = `${this.filePath}.tmp`;
        await fs.writeFile(tmpPath, data, 'utf-8');
        await fs.rename(tmpPath, this.filePath);
      } finally {
        // Clear cache to ensure other readers reload fresh state
        this.cache = null;
        await this.releaseLock();
      }
    });
  }

  private async acquireLock(retries: number = 100, delayMs: number = 10, staleMs: number = 30000): Promise<void> {
    if (this.lockHeld) {
      return; // re-entrant for this instance
    }
    // Ensure the directory for the lock file exists before attempting to open it
    try {
      await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
    } catch {
      // ignore
    }
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const handle = await fs.open(this.lockPath, 'wx');
        await handle.writeFile(String(Date.now()));
        await handle.close();
        this.lockHeld = true;
        return;
      } catch (err: any) {
        // If lock exists and stale, try to clean it up
        try {
          const stat = await fs.stat(this.lockPath);
          const age = Date.now() - stat.mtimeMs;
          if (age > staleMs) {
            await fs.unlink(this.lockPath).catch(() => {});
          }
        } catch {
          // ignore
        }
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    // Last try
    try {
      await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
    } catch {
      // ignore
    }
    const handle = await fs.open(this.lockPath, 'wx');
    await handle.writeFile(String(Date.now()));
    await handle.close();
    this.lockHeld = true;
  }

  // Repair corrupted JSON file by replacing with proper structure
  async repairCorruptedFile(): Promise<void> {
    try {
      // Check if file exists and contains just "null"
      const content = await fs.readFile(this.filePath, 'utf-8');
      if (content.trim() === 'null') {
        logger.warn('Repairing corrupted JSON file', { filePath: this.filePath });
        const repairedContent = JSON.stringify({
          data: {},
          lastModified: Date.now(),
          version: this.version
        }, null, 2);
        await fs.writeFile(this.filePath, repairedContent, 'utf-8');
        logger.info('Successfully repaired JSON file', { filePath: this.filePath });
      }
    } catch (error) {
      // File doesn't exist or other error, that's fine
      logger.debug('JSON file repair not needed', { filePath: this.filePath });
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.lockHeld) return;
    this.lockHeld = false;
    await fs.unlink(this.lockPath).catch(() => {});
  }
}
