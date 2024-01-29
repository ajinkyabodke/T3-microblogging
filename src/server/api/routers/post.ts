import { z } from "zod";

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { posts } from "@/server/db/schema";
import { clerkClient } from "@clerk/nextjs";
import { TRPCError } from "@trpc/server";

import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { Redis } from "@upstash/redis"; // see below for cloudflare and fastly adapters
import { userFilterForClient } from "@/server/helpers/filterUserForClient";
import { InferSelectModel } from "drizzle-orm";

// Create a new ratelimiter, that allows 3 requests per 1 minute
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 m"),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@upstash/ratelimit"
   */
  prefix: "@upstash/ratelimit",
});

const addUserDataToPosts = async (_posts: InferSelectModel<typeof posts>[]) => {
  const userId = _posts.map((post) => post.authorId);
  const users = (
    await clerkClient.users.getUserList({
      userId: userId as string[],
      limit: 110,
    })
  ).map(userFilterForClient);

  return _posts.map((post) => {
    const author = users.find((user) => user.id === post.authorId);

    if (!author) {
      console.error("AUTHOR NOT FOUND", post);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Author for post not found. POST ID: ${post.id}, USER ID: ${post.authorId}`,
      });
    }
    if (!author.username) {
      // user the ExternalUsername
      if (!author.externalUsername) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Author has no GitHub Account: ${author.id}`,
        });
      }
      author.username = author.externalUsername;
    }
    return {
      post,
      author: {
        ...author,
        username: author.username ?? "(username not found)",
      },
    };
  });
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
    .input(
      z.object({
        content: z.string().min(2).max(250),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.userId;

      const { success } = await ratelimit.limit(authorId);

      if (!success) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });

      const post = await ctx.db.insert(posts).values({
        authorId,
        content: input.content,
      });
      return post;
    }),

  getPostsByUserId: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.posts
        .findMany({
          where: (u, { eq }) => eq(u.authorId, input.userId),
          limit: 100,
          orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        })
        .then(addUserDataToPosts),
    ),

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
