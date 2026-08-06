import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  ensureCurrentMemberOutcomeValidator,
  getMemberProfileOutcomeValidator,
} from "./contract/member";
import * as Members from "./model/members";

/** Project the authenticated Clerk identity into a Member. Safe to repeat. */
export const ensureCurrent = mutation({
  args: {},
  returns: ensureCurrentMemberOutcomeValidator,
  handler: async (ctx) => await Members.ensureCurrent(ctx),
});

/** Read a Member's public Profile identity without authentication. */
export const getProfile = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: getMemberProfileOutcomeValidator,
  handler: async (ctx, args) => await Members.getProfile(ctx, args.memberId),
});
