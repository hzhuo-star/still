import { v } from "convex/values";

import { query } from "./_generated/server";
import {
  searchMembersOutcomeValidator,
  searchPostsOutcomeValidator,
} from "./contract/search";
import * as Search from "./model/search";

/** Search current active Post text publicly, in Convex relevance order. */
export const posts = query({
  args: {
    /** The raw, untrusted Search box text. */
    query: v.string(),
  },
  returns: searchPostsOutcomeValidator,
  handler: async (ctx, args) => await Search.searchPosts(ctx, args.query),
});

/** Search current Member Handles and display names publicly. */
export const members = query({
  args: {
    /** The raw, untrusted Search box text. */
    query: v.string(),
  },
  returns: searchMembersOutcomeValidator,
  handler: async (ctx, args) => await Search.searchMembers(ctx, args.query),
});
