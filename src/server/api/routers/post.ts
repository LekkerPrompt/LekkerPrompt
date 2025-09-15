import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";

export const postRouter = createTRPCRouter({
	hello: publicProcedure
		.input(z.object({ text: z.string() }))
		.query(({ input }) => {
			return {
				greeting: `Hello ${input.text}`,
			};
		}),

	create: protectedProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const post = await ctx.storage.createPost({
				name: input.name,
				createdById: ctx.session.user.id,
			});
			return post;
		}),

	getLatest: protectedProcedure.query(async ({ ctx }) => {
		// Simple latest retrieval by scanning stored posts for this user
		const posts = await ctx.storage.findPostsByName(""); // returns all posts
		const userPosts = posts.filter(p => p.createdById === ctx.session.user.id);
		userPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return userPosts[0] ?? null;
	}),

	getSecretMessage: protectedProcedure.query(() => {
		return "you can now see this secret message!";
	}),
});
