import { JSONStore } from './json-store';
import { VectorStore } from './vector-store';
import crypto from 'crypto';

// Data models
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptPreset {
  id: string;
  userId: string;
  name: string;
  taskType: string;
  options: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chat {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: string;
  content: string;
  createdAt: Date;
  userFeedback?: 'like' | 'dislike' | undefined;
}


// Storage instances (users are in-memory only; no users.json persisted)
const inMemoryUsers = new Map<string, User>();
const appSettingStore = new JSONStore<AppSetting>('app-settings');
const promptPresetStore = new JSONStore<PromptPreset>('prompt-presets');
const chatStore = new JSONStore<Chat>('chats');
const chatMessageStore = new JSONStore<ChatMessage>('chat-messages');

// Repair corrupted app-settings.json file on initialization
appSettingStore.repairCorruptedFile().catch(console.error);

// Vector stores for RAG functionality
const promptVectorStore = new VectorStore('prompts');
const chatVectorStore = new VectorStore('chat-messages');

// Database replacement class
export class DataLayer {
  // User operations
  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const user: User = { ...data, id: `user-${Date.now()}`, createdAt: now, updatedAt: now };
    inMemoryUsers.set(user.id, user);
    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    return inMemoryUsers.get(id) || null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    for (const u of inMemoryUsers.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async upsertUser(data: Partial<User> & { id: string }): Promise<User> {
    const existing = await this.findUserById(data.id);
    const now = new Date();
    const user: User = {
      id: data.id,
      name: data.name ?? existing?.name ?? 'Local User',
      email: data.email ?? existing?.email ?? null,
      emailVerified: existing?.emailVerified ?? null,
      image: data.image ?? existing?.image ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    inMemoryUsers.set(user.id, user);
    return user;
  }

  // App Settings operations
  async findAppSetting(key: string): Promise<AppSetting | null> {
    console.log(`[data-layer] Finding app setting: ${key}`);
    const settings = await appSettingStore.findMany(setting => setting.key === key);
    console.log(`[data-layer] Found setting for ${key}:`, settings[0] || null);
    return settings[0] || null;
  }

  async findManyAppSettings(keys: string[]): Promise<AppSetting[]> {
    console.log(`[data-layer] Finding multiple app settings:`, keys);
    const results = await appSettingStore.findMany(setting => keys.includes(setting.key));
    console.log(`[data-layer] Found ${results.length} settings`);
    return results;
  }

  async upsertAppSetting(key: string, value: string | null): Promise<AppSetting> {
    console.log(`[data-layer] Upserting app setting: ${key} = ${value}`);
    const existing = await this.findAppSetting(key);
    const now = new Date();
    
    const setting: AppSetting = {
      id: existing?.id || `setting-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      key,
      value,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    
    console.log(`[data-layer] Upserting setting with id: ${setting.id}`);
    await appSettingStore.upsert(setting.id, setting);
    console.log(`[data-layer] Successfully upserted setting: ${key}`);
    return setting;
  }

  async deleteAppSettings(keys: string[]): Promise<void> {
    const settings = await appSettingStore.findMany(setting => keys.includes(setting.key));
    for (const setting of settings) {
      await appSettingStore.delete(setting.id);
    }
  }

  // Chat operations
  async createChat(data: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chat> {
    try {
      const now = new Date();
      const chat: Chat = {
        ...data,
        id: `chat-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      await chatStore.upsert(chat.id, chat);
      console.log(`Created chat ${chat.id} for user ${chat.userId}`);
      return chat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      throw error;
    }
  }

  async findChatById(id: string): Promise<Chat | null> {
    try {
      return await chatStore.findById(id);
    } catch (error) {
      console.error(`Failed to find chat ${id}:`, error);
      return null;
    }
  }

  async findChatsByUserId(userId: string): Promise<Array<Chat & { messageCount: number }>> {
    try {
      const chats = await chatStore.findMany(chat => chat.userId === userId);
      const chatsWithCounts = await Promise.all(
        chats.map(async (chat) => {
          const messageCount = await chatMessageStore.count(msg => msg.chatId === chat.id);
          return { ...chat, messageCount };
        })
      );
      
      const sorted = chatsWithCounts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      console.log(`Found ${sorted.length} chats for user ${userId}`);
      return sorted;
    } catch (error) {
      console.error(`Failed to find chats for user ${userId}:`, error);
      return [];
    }
  }

  async updateChat(id: string, data: Partial<Chat>): Promise<Chat | null> {
    try {
      const updated = await chatStore.update(id, { ...data, updatedAt: new Date() });
      if (updated) {
        console.log(`Updated chat ${id}`);
      }
      return updated;
    } catch (error) {
      console.error(`Failed to update chat ${id}:`, error);
      return null;
    }
  }

  async deleteChat(id: string): Promise<boolean> {
    try {
      // Delete all messages in the chat first
      const messages = await chatMessageStore.findMany(msg => msg.chatId === id);
      for (const message of messages) {
        await chatMessageStore.delete(message.id);
        await chatVectorStore.delete(message.id);
      }
      
      const deleted = await chatStore.delete(id);
      if (deleted) {
        console.log(`Deleted chat ${id} and ${messages.length} messages`);
      }
      return deleted;
    } catch (error) {
      console.error(`Failed to delete chat ${id}:`, error);
      return false;
    }
  }

  // Chat Message operations
  async createChatMessages(messages: Array<Omit<ChatMessage, 'id' | 'createdAt'>>): Promise<ChatMessage[]> {
    try {
      const now = new Date();
      const createdMessages: ChatMessage[] = [];
      
      for (const msgData of messages) {
        const message: ChatMessage = {
          ...msgData,
          id: crypto.randomUUID(),
          createdAt: now,
        };
        
        await chatMessageStore.upsert(message.id, message);
        
        // Add to vector store for RAG functionality (don't fail if this fails)
        try {
          await chatVectorStore.add(
            message.content,
            {
              messageId: message.id,
              chatId: message.chatId,
              role: message.role,
              timestamp: now.getTime(),
            },
            message.id,
          );
        } catch (vectorError) {
          console.error(`Failed to add message ${message.id} to vector store:`, vectorError);
          // Continue without failing the entire operation
        }
        
        createdMessages.push(message);
      }
      
      console.log(`Created ${createdMessages.length} messages for chat ${messages[0]?.chatId}`);
      return createdMessages;
    } catch (error) {
      console.error('Failed to create chat messages:', error);
      throw error;
    }
  }

  // Atomically append messages to a chat and trim to cap within a single critical section on the messages store
  async appendMessagesWithCap(chatId: string, messages: Array<Omit<ChatMessage, 'id' | 'createdAt' | 'chatId'>>, cap: number): Promise<{ created: ChatMessage[]; deletedIds: string[] }> {
    const now = new Date();
    const created: ChatMessage[] = [];
    const deletedIds: string[] = [];
    // Perform all message mutations under a single file lock to avoid races
    await (chatMessageStore as any).mutate(async (store: any) => {
      // Append
      for (const msgData of messages) {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          chatId,
          role: msgData.role,
          content: msgData.content,
          userFeedback: msgData.userFeedback,
          createdAt: now,
        };
        store.data[message.id] = message as any;
        created.push(message);
      }
      // Enforce cap by trimming oldest
      const all = Object.entries(store.data)
        .map(([id, m]: [string, any]) => ({ ...(m as any), id }))
        .filter((m: any) => m.chatId === chatId)
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const over = all.length - cap;
      if (over > 0) {
        const toRemove = all.slice(0, over);
        for (const m of toRemove) {
          delete store.data[m.id];
          deletedIds.push(m.id);
        }
      }
    });
    // Post-mutation: update chat timestamp (separate file, best-effort)
    await this.updateChat(chatId, { updatedAt: new Date() });
    // Update vector store outside the lock, best-effort
    for (const m of created) {
      try {
        await chatVectorStore.add(
          m.content,
          { messageId: m.id, chatId: m.chatId, role: m.role, timestamp: now.getTime() },
          m.id,
        );
      } catch (vectorError) {
        console.error(`Failed to add message ${m.id} to vector store:`, vectorError);
      }
    }
    for (const id of deletedIds) {
      try { await chatVectorStore.delete(id); } catch (e) { /* ignore */ }
    }
    return { created, deletedIds };
  }

  async findChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const messages = await chatMessageStore.findMany(msg => msg.chatId === chatId);
      const sorted = messages
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-limit);
      
      console.log(`Found ${sorted.length} messages for chat ${chatId}`);
      return sorted;
    } catch (error) {
      console.error(`Failed to find messages for chat ${chatId}:`, error);
      return [];
    }
  }

  async countChatMessages(chatId: string): Promise<number> {
    try {
      return await chatMessageStore.count(msg => msg.chatId === chatId);
    } catch (error) {
      console.error(`Failed to count messages for chat ${chatId}:`, error);
      return 0;
    }
  }

  async deleteChatMessages(messageIds: string[]): Promise<void> {
    try {
      for (const id of messageIds) {
        await chatMessageStore.delete(id);
        // Also remove from vector store (don't fail if this fails)
        try {
          await chatVectorStore.delete(id);
        } catch (vectorError) {
          console.error(`Failed to delete message ${id} from vector store:`, vectorError);
        }
      }
      console.log(`Deleted ${messageIds.length} messages`);
    } catch (error) {
      console.error('Failed to delete chat messages:', error);
      throw error;
    }
  }

  async setMessageFeedback(messageId: string, feedback: 'like' | 'dislike'): Promise<boolean> {
    try {
      console.log(`[data-layer] Setting message feedback: ${messageId}, ${feedback}`);
      
      // First check if the message exists
      const message = await chatMessageStore.findById(messageId);
      if (!message) {
        console.log(`[data-layer] Message not found for feedback: ${messageId}`);
        return false;
      }
      
      // Update in the message store
      try {
        console.log(`[data-layer] Updating message store with feedback`);
        await chatMessageStore.update(messageId, { userFeedback: feedback });
      } catch (storeError) {
        console.error(`[data-layer] Failed to update message store with feedback:`, storeError);
        return false;
      }
      
      // Update in vector store (but don't fail if this part fails)
      try {
        console.log(`[data-layer] Updating vector store with feedback`);
        await chatVectorStore.setUserFeedback(messageId, feedback);
      } catch (vectorError) {
        console.error(`[data-layer] Failed to update feedback in vector store:`, vectorError);
        // Continue without failing the operation
      }
      
      console.log(`[data-layer] Successfully set feedback for message: ${messageId}`);
      return true;
    } catch (error) {
      console.error(`[data-layer] Unexpected error in setMessageFeedback:`, error);
      return false;
    }
  }

  async removeMessageFeedback(messageId: string): Promise<boolean> {
    try {
      console.log(`[data-layer] Removing message feedback: ${messageId}`);
      
      // First check if the message exists
      const message = await chatMessageStore.findById(messageId);
      if (!message) {
        console.log(`[data-layer] Message not found for removing feedback: ${messageId}`);
        return false;
      }
      
      // Update in the message store
      try {
        console.log(`[data-layer] Updating message store to remove feedback`);
        await chatMessageStore.update(messageId, { userFeedback: undefined });
      } catch (storeError) {
        console.error(`[data-layer] Failed to remove feedback from message store:`, storeError);
        return false;
      }
      
      // Update in vector store (but don't fail if this part fails)
      try {
        console.log(`[data-layer] Updating vector store to remove feedback`);
        await chatVectorStore.removeUserFeedback(messageId);
      } catch (vectorError) {
        console.error(`[data-layer] Failed to remove feedback from vector store:`, vectorError);
        // Continue without failing the operation
      }
      
      console.log(`[data-layer] Successfully removed feedback for message: ${messageId}`);
      return true;
    } catch (error) {
      console.error(`[data-layer] Unexpected error in removeMessageFeedback:`, error);
      return false;
    }
  }

  async getAllMessagesWithFeedback(): Promise<ChatMessage[]> {
    try {
      const allMessages = await chatMessageStore.findMany();
      return allMessages.filter(m => m.userFeedback === 'like' || m.userFeedback === 'dislike');
    } catch (error) {
      console.error(`[data-layer] Error getting messages with feedback:`, error);
      return [];
    }
  }

  async resetAllMessageFeedback(): Promise<boolean> {
    try {
      console.log(`[data-layer] Resetting all message feedback`);
      
      // Get all messages with feedback
      const allMessages = await chatMessageStore.findMany();
      const messagesWithFeedback = allMessages.filter(m => m.userFeedback);
      
      console.log(`[data-layer] Found ${messagesWithFeedback.length} messages with feedback to reset`);
      
      // Remove feedback from all messages
      for (const message of messagesWithFeedback) {
        try {
          await chatMessageStore.update(message.id, { userFeedback: undefined });
        } catch (error) {
          console.error(`[data-layer] Failed to reset feedback for message ${message.id}:`, error);
        }
      }
      
      // Reset vector store feedback data completely
      try {
        await chatVectorStore.resetAllFeedback();
      } catch (vectorError) {
        console.error(`[data-layer] Failed to reset vector store feedback:`, vectorError);
        // Continue without failing the operation
      }
      
      console.log(`[data-layer] Successfully reset all message feedback`);
      return true;
    } catch (error) {
      console.error(`[data-layer] Unexpected error in resetAllMessageFeedback:`, error);
      return false;
    }
  }

  // RAG operations for personalized responses
  async searchSimilarMessages(query: string, limit: number = 5): Promise<Array<{ message: ChatMessage; score: number }>> {
    const results = await chatVectorStore.search(query, limit);
    
    const messagesWithScores = await Promise.all(
      results.map(async (result) => {
        const messageId = result.document.metadata.messageId;
        const message = await chatMessageStore.findById(messageId);
        return message ? { message, score: result.score } : null;
      })
    );
    
    return messagesWithScores.filter(Boolean) as Array<{ message: ChatMessage; score: number }>;
  }

  async getPersonalizedPromptSuggestions(query: string, userId: string): Promise<Array<{ message: ChatMessage; score: number }>> {
    // Get personalized recommendations based on user's likes/dislikes
    const results = await chatVectorStore.getPersonalizedRecommendations(query, 10);
    
    const suggestions = await Promise.all(
      results.map(async (result) => {
        const messageId = result.document.metadata.messageId;
        const message = await chatMessageStore.findById(messageId);
        return message ? { message, score: result.score } : null;
      })
    );
    
    return suggestions.filter(Boolean) as Array<{ message: ChatMessage; score: number }>;
  }

  async getUserFeedbackStats(): Promise<{
    totalMessages: number;
    likedCount: number;
    dislikedCount: number;
    neutralCount: number;
  }> {
    const stats = await chatVectorStore.getStats();
    return {
      totalMessages: stats.totalDocuments,
      likedCount: stats.likedCount,
      dislikedCount: stats.dislikedCount,
      neutralCount: stats.neutralCount,
    };
  }

  // Unified RAG context retrieval (always applied across ALL models)
  async getRagContext(query: string, options?: { similarLimit?: number; personalizationLimit?: number }) {
    const similarLimit = options?.similarLimit ?? 6;
    const personalizationLimit = options?.personalizationLimit ?? 6;

    // Similar semantic messages regardless of feedback (neutral allowed for context)
    const similar = await this.searchSimilarMessages(query, similarLimit);

    // Personalized recommendations based strictly on liked/disliked only
    const personalized = await chatVectorStore.getPersonalizedRecommendations(query, personalizationLimit);
    const personalizedResolved = await Promise.all(personalized.map(async (r) => {
      const m = await chatMessageStore.findById(r.document.metadata.messageId);
      return m ? { message: m, score: r.score } : null;
    }));

    return {
      similar: similar.map(s => ({
        id: s.message.id,
        role: s.message.role,
        content: s.message.content,
        score: s.score,
        feedback: s.message.userFeedback,
      })),
      personalized: personalizedResolved.filter(Boolean).map(p => ({
        id: p!.message.id,
        role: p!.message.role,
        content: p!.message.content,
        score: p!.score,
        feedback: p!.message.userFeedback, // guaranteed like/dislike
      })),
    };
  }

  // Prompt Preset operations
  async createPreset(data: Omit<PromptPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptPreset> {
    const now = new Date();
    const preset: PromptPreset = {
      ...data,
      id: `preset-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    await promptPresetStore.upsert(preset.id, preset);
    return preset;
  }

  async findPresetById(id: string): Promise<PromptPreset | null> {
    return await promptPresetStore.findById(id);
  }

  async findPresetsByUserId(userId: string): Promise<PromptPreset[]> {
    return await promptPresetStore.findMany(preset => preset.userId === userId);
  }

  async updatePreset(id: string, data: Partial<PromptPreset>): Promise<PromptPreset | null> {
    return await promptPresetStore.update(id, { ...data, updatedAt: new Date() });
  }

  async deletePreset(id: string): Promise<boolean> {
    return await promptPresetStore.delete(id);
  }


  // Initialize with default local user
  async ensureLocalUser(): Promise<User> {
    const localUserId = 'local-user';
    const existing = inMemoryUsers.get(localUserId);
    if (existing) return existing;
    const now = new Date();
    const user: User = { id: localUserId, name: 'Local User', email: null, emailVerified: null, image: null, createdAt: now, updatedAt: now };
    inMemoryUsers.set(localUserId, user);
    return user;
  }
}

// Export singleton instance
export const dataLayer = new DataLayer();

// Backward compatibility - simulate interface
export const db = {
  user: {
    findUnique: ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return dataLayer.findUserById(where.id);
      if (where.email) return dataLayer.findUserByEmail(where.email);
      return null;
    },
    upsert: ({ where, create, update }: any) => {
      return dataLayer.upsertUser({ ...create, ...update, id: where.id });
    },
  },
  appSetting: {
    findUnique: ({ where }: { where: { key: string } }) => 
      dataLayer.findAppSetting(where.key),
    findMany: ({ where }: { where?: { key?: { in: string[] } } } = {}) => {
      if (where?.key?.in) return dataLayer.findManyAppSettings(where.key.in);
      return [];
    },
    upsert: ({ where, create, update }: any) => 
      dataLayer.upsertAppSetting(where.key, update?.value ?? create?.value),
    deleteMany: ({ where }: { where: { key: string } }) => 
      dataLayer.deleteAppSettings([where.key]),
  },
  chat: {
    create: ({ data }: { data: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'> }) => 
      dataLayer.createChat(data),
    findFirst: ({ where }: { where: { id: string; userId?: string } }) =>
      dataLayer.findChatById(where.id),
    findMany: ({ where, orderBy }: any) => 
      dataLayer.findChatsByUserId(where.userId),
    update: ({ where, data }: { where: { id: string }, data: Partial<Chat> }) =>
      dataLayer.updateChat(where.id, data),
    delete: ({ where }: { where: { id: string } }) =>
      dataLayer.deleteChat(where.id),
  },
  chatMessage: {
    createMany: ({ data }: { data: Array<Omit<ChatMessage, 'id' | 'createdAt'>> }) =>
      dataLayer.createChatMessages(data),
    findMany: ({ where, orderBy, take }: any) =>
      dataLayer.findChatMessages(where.chatId, take),
    count: ({ where }: { where: { chatId: string } }) =>
      dataLayer.countChatMessages(where.chatId),
    deleteMany: ({ where }: { where: { id: { in: string[] } } }) =>
      dataLayer.deleteChatMessages(where.id.in),
  },
};
