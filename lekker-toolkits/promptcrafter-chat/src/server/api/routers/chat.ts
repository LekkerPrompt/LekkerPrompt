import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
const localUserId = 'local-user';

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]).or(z.string()),
  content: z.string(),
  createdAt: z.date().optional(),
});

export const chatRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    type ChatSummary = {
      id: string;
      title: string | null;
      updatedAt: Date;
      _count: { messages: number };
    };
    const isElectron = !!(process as any)?.versions?.electron;
    const uid = isElectron ? localUserId : ctx.session.user.id;
  // ctx.db now guaranteed ready in context creation
  const chats: ChatSummary[] = await ctx.db.chat.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    return chats.map((c) => ({ id: c.id, title: c.title ?? "Untitled", updatedAt: c.updatedAt, messageCount: c._count.messages }));
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const isElectron = !!(process as any)?.versions?.electron;
      const uid = isElectron ? localUserId : ctx.session.user.id;
  const chat = await ctx.db.chat.create({
        data: {
          userId: uid,
          title: input.title ?? null,
        },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });
      return chat;
    }),

  appendMessages: protectedProcedure
    .input(z.object({ chatId: z.string(), messages: z.array(MessageSchema), cap: z.number().default(50) }))
    .mutation(async ({ ctx, input }) => {
      const { chatId, messages, cap } = input;
      // Verify ownership
  const isElectron = !!(process as any)?.versions?.electron;
  const uid = isElectron ? localUserId : ctx.session.user.id;
  const chat = await ctx.db.chat.findFirst({ where: { id: chatId, userId: uid }, select: { id: true } });
      if (!chat) throw new Error("Not found");

      // Insert new messages
      const data = messages.map((m) => ({ chatId, role: m.role, content: m.content }));
      if (data.length > 0) {
        await ctx.db.chatMessage.createMany({ data });
        await ctx.db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
      }

      // Enforce cap
      const total = await ctx.db.chatMessage.count({ where: { chatId } });
      if (total > cap) {
        const toDelete = total - cap;
        const oldest = await ctx.db.chatMessage.findMany({ where: { chatId }, orderBy: { createdAt: "asc" }, take: toDelete, select: { id: true } });
        if (oldest.length) {
          await ctx.db.chatMessage.deleteMany({ where: { id: { in: oldest.map((o: { id: string }) => o.id) } } });
        }
      }

      return { ok: true };
    }),

  get: protectedProcedure
    .input(z.object({ chatId: z.string(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
  const isElectron = !!(process as any)?.versions?.electron;
  const uid = isElectron ? localUserId : ctx.session.user.id;
  const chat = await ctx.db.chat.findFirst({ where: { id: input.chatId, userId: uid }, select: { id: true, title: true } });
      if (!chat) throw new Error("Not found");
      const messages = await ctx.db.chatMessage.findMany({
        where: { chatId: input.chatId },
        orderBy: { createdAt: "asc" },
        take: input.limit,
        select: { id: true, role: true, content: true, createdAt: true },
      });
      return { id: chat.id, title: chat.title ?? "Untitled", messages };
    }),

  remove: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
  const isElectron = !!(process as any)?.versions?.electron;
  const uid = isElectron ? localUserId : ctx.session.user.id;
  await ctx.db.chat.delete({ where: { id: input.chatId, userId: uid } as any });
      return { ok: true };
    }),
});


