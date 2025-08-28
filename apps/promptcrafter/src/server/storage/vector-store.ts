import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolveDataDir } from './data-path';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  timestamp: number;
  userFeedback?: 'like' | 'dislike';
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export class VectorStore {
  private filePath: string;
  private documents: VectorDocument[] = [];
  private loaded = false;

  constructor(storeName: string, dataDir?: string) {
  const baseDir = resolveDataDir(dataDir);
    this.filePath = path.join(baseDir, `${storeName}-vectors.json`);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.documents = JSON.parse(content);
    } catch {
      this.documents = [];
    }
    
    this.loaded = true;
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.documents, null, 2));
  }

  // Simple but effective text embedding using TF-IDF style approach
  private createEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
    const vector = new Array(256).fill(0);
    
    // Create word frequency map
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Convert words to hash positions and populate vector
    wordFreq.forEach((freq, word) => {
      const hash = crypto.createHash('sha256').update(word).digest();
      for (let i = 0; i < hash.length && i < 32; i++) {
        const pos = hash[i]! % vector.length;
        vector[pos] += freq / words.length; // normalize by document length
      }
    });
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return vector;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async add(content: string, metadata: Record<string, any> = {}, customId?: string): Promise<string> {
    await this.load();
    
    const id = customId || crypto.createHash('sha256')
      .update(content + Date.now())
      .digest('hex')
      .substring(0, 16);
    
    const embedding = this.createEmbedding(content);
    
  const document: VectorDocument = { id, content, embedding, metadata, timestamp: Date.now() };
    
    this.documents.push(document);
    await this.save();
    
    return id;
  }

  async search(
    query: string, 
    limit: number = 5, 
    filters?: {
      userFeedback?: 'like' | 'dislike';
      metadata?: Record<string, any>;
    }
  ): Promise<SearchResult[]> {
    await this.load();
    
    const queryEmbedding = this.createEmbedding(query);
    
    let candidates = this.documents;
    
    // Apply filters
    if (filters?.userFeedback) {
      candidates = candidates.filter(doc => doc.userFeedback === filters.userFeedback);
    }
    
    if (filters?.metadata) {
      candidates = candidates.filter(doc => {
        return Object.entries(filters.metadata!).every(([key, value]) => 
          doc.metadata[key] === value
        );
      });
    }
    
    const results = candidates
      .map(doc => ({
        document: doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(result => result.score > 0.1) // Filter out very low similarity
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }

  async findById(id: string): Promise<VectorDocument | null> {
    await this.load();
    return this.documents.find(doc => doc.id === id) || null;
  }

  async setUserFeedback(id: string, feedback: 'like' | 'dislike'): Promise<boolean> {
    await this.load();
    const docIndex = this.documents.findIndex(doc => doc.id === id);
    
    if (docIndex === -1) return false;
    
    const doc = this.documents[docIndex];
    if (doc) {
      doc.userFeedback = feedback;
    }
    await this.save();
    
    return true;
  }

  async removeUserFeedback(id: string): Promise<boolean> {
    await this.load();
    const docIndex = this.documents.findIndex(doc => doc.id === id);
    
    if (docIndex === -1) return false;
    
    const doc = this.documents[docIndex];
    if (doc) {
      delete doc.userFeedback;
    }
    await this.save();
    
    return true;
  }

  async getLikedPrompts(): Promise<VectorDocument[]> {
    await this.load();
    return this.documents.filter(doc => doc.userFeedback === 'like');
  }

  async getDislikedPrompts(): Promise<VectorDocument[]> {
    await this.load();
    return this.documents.filter(doc => doc.userFeedback === 'dislike');
  }

  // Get prompts that are similar to liked prompts for personalization
  // Only considers messages with explicit feedback (like/dislike)
  async getPersonalizedRecommendations(query: string, limit: number = 5): Promise<SearchResult[]> {
    const likedPrompts = await this.getLikedPrompts();
    const dislikedPrompts = await this.getDislikedPrompts();

    // If no feedback data exists, return empty results (do NOT learn from neutral messages)
    if (likedPrompts.length === 0 && dislikedPrompts.length === 0) {
      return [];
    }

    // Composite query seeds personalization with positive (liked) content primarily
    const likedContent = likedPrompts.map(p => p.content).join(' ');
    const enhancedQuery = likedContent ? `${query} ${likedContent}` : query;

    // Manually score ONLY feedback-tagged documents (exclude neutral entirely)
    const feedbackDocs = [...likedPrompts, ...dislikedPrompts];
    const queryEmbedding = this.createEmbedding(enhancedQuery);
    const results: SearchResult[] = feedbackDocs
      .map(doc => ({
        document: doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(r => r.score > 0.05) // keep low threshold to allow diversity
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  async delete(id: string): Promise<boolean> {
    await this.load();
    const index = this.documents.findIndex(doc => doc.id === id);
    
    if (index === -1) return false;
    
    this.documents.splice(index, 1);
    await this.save();
    
    return true;
  }

  async clear(): Promise<void> {
    await this.load();
    this.documents = [];
    await this.save();
  }

  async getStats(): Promise<{
    totalDocuments: number;
    likedCount: number;
    dislikedCount: number;
    neutralCount: number;
  }> {
    await this.load();
    
    return {
      totalDocuments: this.documents.length,
      likedCount: this.documents.filter(doc => doc.userFeedback === 'like').length,
      dislikedCount: this.documents.filter(doc => doc.userFeedback === 'dislike').length,
      neutralCount: this.documents.filter(doc => !doc.userFeedback).length,
    };
  }
}
