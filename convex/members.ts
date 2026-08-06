import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { memberProfileValidator } from "./memberContract";
import * as Members from "./model/members";

/** Project the authenticated Clerk identity into a Member. Safe to repeat. */
export const ensureCurrent = mutation({
  args: {},
  returns: v.union(
    v.object({ _tag: v.literal("ok"), memberId: v.id("members") }),
    v.object({ _tag: v.literal("unauthenticated") }),
  ),
  handler: async (ctx) => await Members.ensureCurrent(ctx),
});

/** Read a Member's public Profile identity without authentication. */
export const getProfile = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: v.union(
    v.object({ _tag: v.literal("ok"), profile: memberProfileValidator }),
    v.object({ _tag: v.literal("member-not-found") }),
  ),
  handler: async (ctx, args) => await Members.getProfile(ctx, args.memberId),
});
