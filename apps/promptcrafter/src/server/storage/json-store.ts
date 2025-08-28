import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolveDataDir } from './data-path';

export interface DataStore<T> {
  data: Record<string, T>;
  lastModified: number;
  version: string;
}

export class JSONStore<T> {
  private filePath: string;
  private cache: DataStore<T> | null = null;
  private readonly version = '1.0.0';

  constructor(filename: string, dataDir?: string) {
  const baseDir = resolveDataDir(dataDir);
    this.filePath = path.join(baseDir, `${filename}.json`);
  }

  async load(): Promise<DataStore<T>> {
    if (this.cache) return this.cache;
    
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
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
    } catch {
      this.cache = { data: {}, lastModified: Date.now(), version: this.version };
    }
    
    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    
    this.cache.lastModified = Date.now();
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      // Use JSON replacer to handle Date objects properly
      const data = JSON.stringify(this.cache, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }, 2);
      await fs.writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error(`Failed to save JSON store ${this.filePath}:`, error);
      throw error;
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
    const store = await this.load();
    store.data[id] = item;
    await this.save();
    // Clear cache to ensure fresh reads
    this.cache = null;
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
    
    return store.data[id];
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
}
