import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolveDataDir } from './data-path';
import { logger } from '../logging';

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
  private embeddingCache = new Map<string, number[]>();
  private searchIndex: Map<string, number[]> = new Map(); // word -> documents containing it
  private lastIndexUpdate = 0;

  constructor(storeName: string, dataDir?: string) {
  const baseDir = resolveDataDir(dataDir);
    this.filePath = path.join(baseDir, `${storeName}-vectors.json`);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      // Repair: ensure array shape; handle null or object files
      if (!Array.isArray(parsed)) {
        this.documents = [];
      } else {
        // Validate minimal structure for each entry; drop malformed
        this.documents = parsed.filter((d: any) => d && typeof d.id === 'string' && typeof d.content === 'string' && Array.isArray(d.embedding));
      }
    } catch {
      this.documents = [];
    }
    
    this.loaded = true;
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.documents, null, 2));
  }

  // Optimized text embedding with caching
  private createEmbedding(text: string): number[] {
    // Check cache first
    const cacheKey = crypto.createHash('md5').update(text).digest('hex');
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return [...cached]; // Return copy to prevent mutations
    }

    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && w.length < 50); // Filter out very short/long words
    const vector = new Array(256).fill(0);

    // Create word frequency map with stop word filtering
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const wordFreq = new Map<string, number>();

    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    // Convert words to hash positions and populate vector
    wordFreq.forEach((freq, word) => {
      const hash = crypto.createHash('sha256').update(word).digest();
      for (let i = 0; i < Math.min(hash.length, 16); i++) { // Use fewer hash bytes for speed
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

    // Cache the result (limit cache size)
    if (this.embeddingCache.size < 10000) { // Limit cache to 10k entries
      this.embeddingCache.set(cacheKey, [...vector]);
    }

    return vector;
  }

  // Build search index for faster lookups
  private buildSearchIndex(): void {
    this.searchIndex.clear();

    this.documents.forEach((doc, index) => {
      const words = doc.content.toLowerCase().split(/\W+/).filter(w => w.length > 2);

      words.forEach(word => {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        const indices = this.searchIndex.get(word)!;
        if (!indices.includes(index)) {
          indices.push(index);
        }
      });
    });

    this.lastIndexUpdate = Date.now();
  }

  // Get candidate documents using inverted index
  private getCandidateDocuments(query: string): number[] {
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const candidateSets: Set<number>[] = [];

    queryWords.forEach(word => {
      const indices = this.searchIndex.get(word);
      if (indices) {
        candidateSets.push(new Set(indices));
      }
    });

    if (candidateSets.length === 0) {
      // If no matches in index, fall back to all documents
      return this.documents.map((_, index) => index);
    }

    // Find intersection of all candidate sets
    const result = new Set<number>();
    const firstSet = candidateSets[0];

    if (firstSet) {
      firstSet.forEach(index => {
        let include = true;
        for (let i = 1; i < candidateSets.length; i++) {
          if (!candidateSets[i]?.has(index)) {
            include = false;
            break;
          }
        }
        if (include) {
          result.add(index);
        }
      });
    }

    // If too few candidates, expand search
    if (result.size < 10) {
      return this.documents.map((_, index) => index);
    }

    return Array.from(result);
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

    // Update search index incrementally
    const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const docIndex = this.documents.length - 1;

    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      const indices = this.searchIndex.get(word)!;
      if (!indices.includes(docIndex)) {
        indices.push(docIndex);
      }
    });

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

    // Rebuild index if it's stale (older than 5 minutes) or empty
    if (this.searchIndex.size === 0 || (Date.now() - this.lastIndexUpdate) > 300000) {
      this.buildSearchIndex();
    }

    // Get candidate documents using inverted index
    const candidateIndices = this.getCandidateDocuments(query);
    let candidates = candidateIndices.map(index => this.documents[index]).filter((doc): doc is VectorDocument => doc !== undefined);

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

    // If no candidates found through index, fall back to full search
    if (candidates.length === 0) {
      candidates = this.documents;
    }

    const queryEmbedding = this.createEmbedding(query);

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
    try {
      await this.load();
      const docIndex = this.documents.findIndex(doc => doc.id === id);
      
      if (docIndex === -1) {
        logger.debug('VectorStore document not found for feedback', { documentId: id });
        return false;
      }
      
      const doc = this.documents[docIndex];
      if (doc) {
        doc.userFeedback = feedback;
        logger.debug('VectorStore set feedback for document', { documentId: id, feedback });
        await this.save();
        return true;
      }
      return false;
    } catch (error) {
      console.error(`VectorStore: Error setting user feedback:`, error);
      return false; // Don't throw, return false to indicate failure
    }
  }

  async removeUserFeedback(id: string): Promise<boolean> {
    try {
      await this.load();
      const docIndex = this.documents.findIndex(doc => doc.id === id);
      
      if (docIndex === -1) {
        logger.debug('VectorStore document not found for removing feedback', { documentId: id });
        return false;
      }
      
      const doc = this.documents[docIndex];
      if (doc) {
        delete doc.userFeedback;
        logger.debug('VectorStore removed feedback for document', { documentId: id });
        await this.save();
        return true;
      }
      return false;
    } catch (error) {
      console.error(`VectorStore: Error removing user feedback:`, error);
      return false; // Don't throw, return false to indicate failure
    }
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

  async resetAllFeedback(): Promise<void> {
    await this.load();
    
    // Remove ALL documents - complete reset of the learning environment
    this.documents = [];
    
    await this.save();
  }
}
