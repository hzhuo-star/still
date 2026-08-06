import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import schema from "./schema";

const migrations = new Migrations(components.migrations, { schema });

/**
 * Backfill legacy Posts into explicit active Standalone Posts.
 *
 * The migration is idempotent: explicit relational records are left unchanged,
 * while each legacy record receives its kind, state, and initialized counters.
 */
export const backfillLegacyPosts = migrations.define({
  table: "posts",
  migrateOne: async (ctx, post) => {
    if ("kind" in post) {
      return;
    }

    await ctx.db.patch(post._id, {
      state: "active",
      kind: "standalone",
      activeReplyCount: 0,
      activeRepostCount: 0,
    });
  },
});
