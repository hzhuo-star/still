import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  createPostOutcomeValidator,
  createQuoteArgsValidator,
  createQuoteOutcomeValidator,
  createReplyArgsValidator,
  createReplyOutcomeValidator,
  editPostArgsValidator,
  editPostOutcomeValidator,
  getConversationArgsValidator,
  getConversationOutcomeValidator,
  listByMemberOutcomeValidator,
  listFollowingFeedOutcomeValidator,
  postListValidator,
  removePostOutcomeValidator,
  toggleLikeOutcomeValidator,
  toggleRepostOutcomeValidator,
} from "./contract/post";
import * as Posts from "./model/posts";

/** Read the public Feed: the newest 50 Posts in reverse chronological order. */
export const listFeed = query({
  args: {},
  returns: postListValidator,
  handler: async (ctx) => await Posts.listFeed(ctx),
});

/** Read the acting Member's exact Following Feed, newest first. */
export const listFollowingFeed = query({
  args: {},
  returns: listFollowingFeedOutcomeValidator,
  handler: async (ctx) => await Posts.listFollowingFeed(ctx),
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

/** Publish a Reply to an active authored Post. */
export const createReply = mutation({
  args: createReplyArgsValidator.fields,
  returns: createReplyOutcomeValidator,
  handler: async (ctx, args) =>
    await Posts.createReply(ctx, args.parentPostId, args.content),
});

/** Publish Quote commentary, or Repost when its commentary is blank. */
export const createQuote = mutation({
  args: createQuoteArgsValidator.fields,
  returns: createQuoteOutcomeValidator,
  handler: async (ctx, args) =>
    await Posts.createQuote(ctx, args.targetPostId, args.commentary),
});

/** Replace the text of an active Post the authenticated Member authored. */
export const edit = mutation({
  args: editPostArgsValidator.fields,
  returns: editPostOutcomeValidator,
  handler: async (ctx, args) =>
    await Posts.edit(ctx, args.postId, args.expectedRevision, args.content),
});

/** Resolve a stable Post URL into one bounded, flat public Conversation. */
export const getConversation = query({
  args: getConversationArgsValidator.fields,
  returns: getConversationOutcomeValidator,
  handler: async (ctx, args) => await Posts.getConversation(ctx, args.postId),
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

/** Repost or stop Reposting an ultimate source as the authenticated Member. */
export const toggleRepost = mutation({
  args: {
    /** The selected Post; Repost wrappers normalize to their source. */
    postId: v.id("posts"),
  },
  returns: toggleRepostOutcomeValidator,
  handler: async (ctx, args) => await Posts.toggleRepost(ctx, args.postId),
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
