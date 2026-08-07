import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import * as MemberProfile from "./lib/memberProfile";
import schema from "./schema";

const migrations = new Migrations(components.migrations, { schema });

/**
 * Add compatible registration, graph-count, and Search fields to legacy Members.
 *
 * Registered fields stay optional during expansion; legacy identities become
 * explicitly pending without changing their readable public projection.
 */
export const backfillMembers = migrations.define({
  table: "members",
  migrateOne: async (ctx, member) => {
    if (
      member.registrationState !== undefined &&
      member.followerCount !== undefined &&
      member.followingCount !== undefined &&
      member.searchText !== undefined
    ) {
      return;
    }

    await ctx.db.patch("members", member._id, {
      registrationState: member.registrationState ?? "pending",
      followerCount: member.followerCount ?? 0,
      followingCount: member.followingCount ?? 0,
      searchText:
        member.searchText ??
        MemberProfile.searchProjection([member.displayName]),
    });
  },
});

/** Add the initial optimistic-concurrency revision to active text-bearing Posts. */
export const backfillPosts = migrations.define({
  table: "posts",
  migrateOne: async (ctx, post) => {
    if (
      post.state !== "active" ||
      post.kind === "repost" ||
      post.revision !== undefined
    ) {
      return;
    }

    await ctx.db.patch("posts", post._id, { revision: 0 });
  },
});
