import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { dataLayer } from "@/server/storage/data-layer";
const localUserId = 'local-user';

const MessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  userFeedback: z.enum(["like", "dislike"]).optional(),
});

export const chatRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isElectron = !!(process as any)?.versions?.electron;
    const uid = isElectron ? localUserId : ctx.session.user.id;
    
    console.log(`Chat list query: isElectron=${isElectron}, uid=${uid}`);
    const chats = await ctx.storage.findChatsByUserId(uid);
    console.log(`Found ${chats.length} chats for user ${uid}`);
    return chats.map((c) => ({ 
      id: c.id, 
      title: c.title ?? "Untitled", 
      updatedAt: c.updatedAt, 
      messageCount: c.messageCount 
    }));
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;
      
      console.log(`Creating chat: isElectron=${isElectron}, uid=${uid}, title=${input.title}`);
      const chat = await ctx.storage.createChat({
        userId: uid,
        title: input.title ?? null,
      });
      console.log(`Created chat:`, chat);
      
      return chat;
    }),

  appendMessages: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      messages: z.array(MessageSchema),
      cap: z.number().default(50)
    }))
    .mutation(async ({ ctx, input }) => {
      const { chatId, messages, cap } = input;
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;

      console.log(`appendMessages called for chatId: ${chatId}, uid: ${uid}, messages:`, messages.length);

      // Verify ownership
      const chat = await ctx.storage.findChatById(chatId);
      if (!chat || chat.userId !== uid) {
        console.error(`Chat not found or access denied: chat=${chat?.id}, chatUserId=${chat?.userId}, uid=${uid}`);
        throw new Error("Not found");
      }

      // Atomically append and trim to cap within one critical section on the messages store
      let createdMessages: any[] = [];
      if (messages.length > 0) {
        const messagesToCreate = messages.map((m) => ({
          role: m.role,
          content: m.content,
          userFeedback: m.userFeedback,
        }));
        console.log(`Creating messages (atomic append+trim):`, messagesToCreate.length);
        const result = await ctx.storage.appendMessagesWithCap(chatId, messagesToCreate, cap);
        createdMessages = result.created;
      }

      return {
        ok: true,
        createdMessages: createdMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          userFeedback: m.userFeedback
        }))
      };
    }),

  get: protectedProcedure
    .input(z.object({ chatId: z.string(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;
      
      const chat = await ctx.storage.findChatById(input.chatId);
      if (!chat || chat.userId !== uid) {
        throw new Error("Not found");
      }
      
      const messages = await ctx.storage.findChatMessages(input.chatId, input.limit);
      return { 
        id: chat.id, 
        title: chat.title ?? "Untitled", 
        messages 
      };
    }),

  remove: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;
      
      const chat = await ctx.storage.findChatById(input.chatId);
      if (!chat || chat.userId !== uid) {
        throw new Error("Not found");
      }
      
      await ctx.storage.deleteChat(input.chatId);
      return { ok: true };
    }),

  // New endpoints for like/dislike functionality
  setMessageFeedback: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      feedback: z.enum(["like", "dislike"])
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`Setting message feedback: messageId=${input.messageId}, feedback=${input.feedback}`);
        const success = await ctx.storage.setMessageFeedback(input.messageId, input.feedback);
        if (!success) {
          console.error(`Message not found: ${input.messageId}`);
          throw new Error("Message not found");
        }
        console.log(`Successfully set feedback for message ${input.messageId}`);
        return { ok: true };
      } catch (error) {
        console.error(`Failed to set message feedback:`, error);
        throw new Error(`Failed to set message feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  removeMessageFeedback: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`Removing message feedback: messageId=${input.messageId}`);
        const success = await ctx.storage.removeMessageFeedback(input.messageId);
        if (!success) {
          console.error(`Message not found: ${input.messageId}`);
          throw new Error("Message not found");
        }
        console.log(`Successfully removed feedback for message ${input.messageId}`);
        return { ok: true };
      } catch (error) {
        console.error(`Failed to remove message feedback:`, error);
        throw new Error(`Failed to remove message feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // RAG-powered personalized suggestions
  getPersonalizedSuggestions: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;
      
      const suggestions = await ctx.storage.getPersonalizedPromptSuggestions(input.query, uid);
      return suggestions.map(s => ({
        message: s.message,
        score: s.score,
      }));
    }),

  // Search similar messages
  searchSimilar: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.storage.searchSimilarMessages(input.query, input.limit);
      return results.map(r => ({
        message: r.message,
        score: r.score,
      }));
    }),

  // Get user feedback stats
  getFeedbackStats: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.storage.getUserFeedbackStats();
    }),
});


