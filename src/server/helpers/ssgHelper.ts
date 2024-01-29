import { db } from "@/server/db";

import superjson from "superjson";
import { appRouter } from "../api/root";
import { createServerSideHelpers } from "@trpc/react-query/server";

export const generateSSGHelper = () =>
  createServerSideHelpers({
    router: appRouter,
    ctx: { db, userId: null },
    transformer: superjson, // optional - adds superjson serialization
  });
