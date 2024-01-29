import { z } from "zod";

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { posts } from "@/server/db/schema";
import { clerkClient } from "@clerk/nextjs";
import { User } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";

const userFilterForClient = (user: User) => {
  return {
    id: user.id,
    username: `${user.firstName.toLowerCase()}${user.lastName?.toLowerCase()}`,
    imageUrl: user.imageUrl,
  };
};

export const postsRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: privateProcedure
    .input(z.object({ content: z.string().emoji().min(1).max(250) }))
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.userId;
      const post = await ctx.db.insert(posts).values({
        authorId,
        content: input.content,
      });
      return post;
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.db.query.posts.findMany({
      limit: 100,
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    });

    const users = (
      await clerkClient.users.getUserList({
        userId: posts.map((post) => post.authorId).filter(Boolean) as string[],
        limit: 100,
      })
    ).map(userFilterForClient);

    console.log(users);
    return posts.map((post) => {
      const author = users.find((user) => user.id === post.authorId);

      if (!author) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Author for post not found",
        });
      }
      return {
        post,
        author: {
          ...author,
          username: author.username,
        },
      };
    });
    // return ctx.db.query.posts.findMany({
    //   orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    // });
  }),
});
