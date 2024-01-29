import type { User } from "@clerk/nextjs/server";
export const userFilterForClient = (user: User) => {
  return {
    id: user.id,
    // username: `${user.firstName.toLowerCase()}${user.lastName?.toLowerCase()}`,
    username: user.username,
    imageUrl: user.imageUrl,
  };
};
