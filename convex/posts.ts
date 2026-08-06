import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { memberProfileValidator } from "./memberContract";
import * as Posts from "./model/posts";

/** The complete immutable display model for one Post. */
const postViewValidator = v.object({
  postId: v.id("posts"),
  content: v.string(),
  publishedAt: v.number(),
  likeCount: v.number(),
  viewerHasLiked: v.boolean(),
  viewerCanDelete: v.boolean(),
  author: memberProfileValidator,
});

/** Whether a Post list contains every available Post or only the newest 50. */
const listEndingValidator = v.union(
  v.literal("complete"),
  v.literal("truncated"),
);

/** Read the public Feed: the newest 50 Posts in reverse chronological order. */
export const listFeed = query({
  args: {},
  returns: v.object({
    posts: v.array(postViewValidator),
    ending: listEndingValidator,
  }),
  handler: async (ctx) => await Posts.listFeed(ctx),
});

/** Read one Member's Posts for their public Profile, newest first. */
export const listByMember = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: v.union(
    v.object({
      _tag: v.literal("ok"),
      posts: v.array(postViewValidator),
      ending: listEndingValidator,
    }),
    v.object({ _tag: v.literal("member-not-found") }),
  ),
  handler: async (ctx, args) => await Posts.listByMember(ctx, args.memberId),
});

/** Publish a Post authored by the authenticated Member. */
export const create = mutation({
  args: {
    /** The raw composer draft; parsed into Post content before persisting. */
    content: v.string(),
  },
  returns: v.union(
    v.object({ _tag: v.literal("ok"), postId: v.id("posts") }),
    v.object({ _tag: v.literal("unauthenticated") }),
    v.object({
      _tag: v.literal("invalid-content"),
      reason: v.union(v.literal("empty"), v.literal("too-long")),
    }),
  ),
  handler: async (ctx, args) => await Posts.create(ctx, args.content),
});

/** Like or unlike a Post as the authenticated Member. */
export const toggleLike = mutation({
  args: {
    /** The Post whose Like state the Member is toggling. */
    postId: v.id("posts"),
  },
  returns: v.union(
    v.object({
      _tag: v.literal("ok"),
      state: v.union(v.literal("liked"), v.literal("unliked")),
      likeCount: v.number(),
    }),
    v.object({ _tag: v.literal("unauthenticated") }),
    v.object({ _tag: v.literal("post-not-found") }),
  ),
  handler: async (ctx, args) => await Posts.toggleLike(ctx, args.postId),
});

/** Delete a Post the authenticated Member authored. */
export const remove = mutation({
  args: {
    /** The Post the author is deleting. */
    postId: v.id("posts"),
  },
  returns: v.union(
    v.object({ _tag: v.literal("ok") }),
    v.object({ _tag: v.literal("unauthenticated") }),
    v.object({ _tag: v.literal("forbidden") }),
    v.object({ _tag: v.literal("post-not-found") }),
  ),
  handler: async (ctx, args) => await Posts.remove(ctx, args.postId),
});
