import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  createPostOutcomeValidator,
  listByMemberOutcomeValidator,
  postListValidator,
  removePostOutcomeValidator,
  toggleLikeOutcomeValidator,
} from "./contract/post";
import * as Posts from "./model/posts";

/** Read the public Feed: the newest 50 Posts in reverse chronological order. */
export const listFeed = query({
  args: {},
  returns: postListValidator,
  handler: async (ctx) => await Posts.listFeed(ctx),
});

/** Read one Member's Posts for their public Profile, newest first. */
export const listByMember = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: listByMemberOutcomeValidator,
  handler: async (ctx, args) => await Posts.listByMember(ctx, args.memberId),
});

/** Publish a Post authored by the authenticated Member. */
export const create = mutation({
  args: {
    /** The raw composer draft; parsed into Post content before persisting. */
    content: v.string(),
  },
  returns: createPostOutcomeValidator,
  handler: async (ctx, args) => await Posts.create(ctx, args.content),
});

/** Like or unlike a Post as the authenticated Member. */
export const toggleLike = mutation({
  args: {
    /** The Post whose Like state the Member is toggling. */
    postId: v.id("posts"),
  },
  returns: toggleLikeOutcomeValidator,
  handler: async (ctx, args) => await Posts.toggleLike(ctx, args.postId),
});

/** Delete a Post the authenticated Member authored. */
export const remove = mutation({
  args: {
    /** The Post the author is deleting. */
    postId: v.id("posts"),
  },
  returns: removePostOutcomeValidator,
  handler: async (ctx, args) => await Posts.remove(ctx, args.postId),
});
