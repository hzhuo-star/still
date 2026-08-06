import { v, type Infer } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { currentMember, ensureMember } from "./members";
import * as PostContent from "./postContent";
import { shouldNeverHappen } from "./result";

/** The maximum number of Posts a Feed or Profile renders. */
const FEED_LIMIT = 50;

/** The complete immutable display model for one Post. */
const postViewValidator = v.object({
  /** The Post's canonical identifier. */
  postId: v.id("posts"),
  /** Parsed plain-text Post content with internal line breaks preserved. */
  content: v.string(),
  /** Server creation time in milliseconds since the Unix epoch. */
  publishedAt: v.number(),
  /** The Post's current Like count. */
  likeCount: v.number(),
  /** Whether the current viewer has Liked the Post. */
  viewerHasLiked: v.boolean(),
  /** Whether the current viewer may delete the Post. */
  viewerCanDelete: v.boolean(),
  /** The Post author's projected public identity. */
  author: v.object({
    memberId: v.id("members"),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
  }),
});

/** The complete immutable display model for one Post. */
export type PostView = Infer<typeof postViewValidator>;

/** Whether a Post list contains every available Post or only the newest 50. */
const listEndingValidator = v.union(
  v.literal("complete"),
  v.literal("truncated"),
);

/** Whether a Post list contains every available Post or only the newest 50. */
export type ListEnding = Infer<typeof listEndingValidator>;

async function toPostView(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewer: Doc<"members"> | null,
): Promise<PostView> {
  const author =
    (await ctx.db.get("members", post.authorId)) ??
    shouldNeverHappen("Post author missing; Member deletion is out of scope");

  const like =
    viewer === null
      ? null
      : await ctx.db
          .query("likes")
          .withIndex("by_postId_and_memberId", (q) =>
            q.eq("postId", post._id).eq("memberId", viewer._id),
          )
          .unique();

  return {
    postId: post._id,
    content: post.content,
    publishedAt: post._creationTime,
    likeCount: post.likeCount,
    viewerHasLiked: like !== null,
    viewerCanDelete: viewer !== null && viewer._id === post.authorId,
    author: {
      memberId: author._id,
      displayName: author.displayName,
      ...(author.avatarUrl === undefined
        ? {}
        : { avatarUrl: author.avatarUrl }),
    },
  };
}

async function toBoundedList(
  ctx: QueryCtx,
  page: ReadonlyArray<Doc<"posts">>,
  viewer: Doc<"members"> | null,
): Promise<{ posts: PostView[]; ending: ListEnding }> {
  const posts = await Promise.all(
    page.slice(0, FEED_LIMIT).map((post) => toPostView(ctx, post, viewer)),
  );

  return {
    posts,
    ending: page.length > FEED_LIMIT ? "truncated" : "complete",
  };
}

/**
 * Read the public Feed: the newest 50 Posts in reverse chronological order.
 * Reads one extra record solely to distinguish a complete Feed from a
 * truncated one.
 */
export const listFeed = query({
  args: {},
  returns: v.object({
    posts: v.array(postViewValidator),
    ending: listEndingValidator,
  }),
  handler: async (ctx) => {
    const viewer = await currentMember(ctx);
    const page = await ctx.db
      .query("posts")
      .order("desc")
      .take(FEED_LIMIT + 1);

    return await toBoundedList(ctx, page, viewer);
  },
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
  handler: async (ctx, args) => {
    const memberId = ctx.db.normalizeId("members", args.memberId);

    if (memberId === null) {
      return { _tag: "member-not-found" as const };
    }

    const member = await ctx.db.get("members", memberId);

    if (member === null) {
      return { _tag: "member-not-found" as const };
    }

    const viewer = await currentMember(ctx);
    const page = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", memberId))
      .order("desc")
      .take(FEED_LIMIT + 1);

    return { _tag: "ok" as const, ...(await toBoundedList(ctx, page, viewer)) };
  },
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
  handler: async (ctx, args) => {
    const member = await ensureMember(ctx);

    if (member === null) {
      return { _tag: "unauthenticated" as const };
    }

    const parsed = PostContent.parse(args.content);

    if (parsed._tag === "err") {
      return { _tag: "invalid-content" as const, reason: parsed.error.reason };
    }

    const postId = await ctx.db.insert("posts", {
      authorId: member._id,
      content: parsed.value,
      likeCount: 0,
    });

    return { _tag: "ok" as const, postId };
  },
});

/**
 * Like or unlike a Post as the authenticated Member. At most one Like per
 * Member/Post pair is kept, and the Post's Like count is maintained in the
 * same transaction.
 */
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
  handler: async (ctx, args) => {
    const member = await ensureMember(ctx);

    if (member === null) {
      return { _tag: "unauthenticated" as const };
    }

    const post = await ctx.db.get("posts", args.postId);

    if (post === null) {
      return { _tag: "post-not-found" as const };
    }

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_postId_and_memberId", (q) =>
        q.eq("postId", post._id).eq("memberId", member._id),
      )
      .unique();

    if (existing === null) {
      await ctx.db.insert("likes", { memberId: member._id, postId: post._id });
      const likeCount = post.likeCount + 1;
      await ctx.db.patch("posts", post._id, { likeCount });
      return { _tag: "ok" as const, state: "liked" as const, likeCount };
    }

    await ctx.db.delete("likes", existing._id);
    const likeCount = post.likeCount - 1;
    await ctx.db.patch("posts", post._id, { likeCount });
    return { _tag: "ok" as const, state: "unliked" as const, likeCount };
  },
});

/**
 * Delete a Post the authenticated Member authored, removing its associated
 * Likes in the same transaction.
 */
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
  handler: async (ctx, args) => {
    const member = await ensureMember(ctx);

    if (member === null) {
      return { _tag: "unauthenticated" as const };
    }

    const post = await ctx.db.get("posts", args.postId);

    if (post === null) {
      return { _tag: "post-not-found" as const };
    }

    if (post.authorId !== member._id) {
      return { _tag: "forbidden" as const };
    }

    const likes = ctx.db
      .query("likes")
      .withIndex("by_postId_and_memberId", (q) => q.eq("postId", post._id));

    for await (const like of likes) {
      await ctx.db.delete("likes", like._id);
    }

    await ctx.db.delete("posts", post._id);

    return { _tag: "ok" as const };
  },
});
