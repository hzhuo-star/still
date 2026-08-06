import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as PostContent from "../lib/postContent";
import {
  CONVERSATION_REPLY_LIMIT,
  FEED_LIMIT,
  type ConversationEntry,
  type CreatePostOutcome,
  type CreateReplyOutcome,
  type GetConversationOutcome,
  type ListByMemberOutcome,
  type PostList,
  type PostView,
  type RemovePostOutcome,
  type ToggleLikeOutcome,
} from "../contract/post";
import { shouldNeverHappen } from "../lib/result";
import { currentMemberId, ensureCurrent, getProfile } from "./members";

async function toPostView(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewerId: Doc<"members">["_id"] | null,
): Promise<PostView> {
  if (
    ("state" in post && post.state === "deleted") ||
    ("kind" in post && post.kind === "repost")
  ) {
    return shouldNeverHappen("Only active authored Posts have display models");
  }

  const authorOutcome = await getProfile(ctx, post.authorId);
  const author =
    authorOutcome._tag === "ok"
      ? authorOutcome.profile
      : shouldNeverHappen(
          "Post author missing; Member deletion is out of scope",
        );

  const like =
    viewerId === null
      ? null
      : await ctx.db
          .query("likes")
          .withIndex("by_postId_and_memberId", (q) =>
            q.eq("postId", post._id).eq("memberId", viewerId),
          )
          .unique();

  if (!("kind" in post)) {
    return {
      postId: post._id,
      kind: "standalone",
      content: post.content,
      publishedAt: post._creationTime,
      likeCount: post.likeCount,
      activeReplyCount: 0,
      activeRepostCount: 0,
      viewerHasLiked: like !== null,
      viewerCanDelete: viewerId === post.authorId,
      author,
    };
  }

  const common = {
    postId: post._id,
    content: post.content,
    publishedAt: post._creationTime,
    likeCount: post.likeCount,
    activeReplyCount: post.activeReplyCount,
    activeRepostCount: post.activeRepostCount,
    viewerHasLiked: like !== null,
    viewerCanDelete: viewerId === post.authorId,
    author,
  };

  if (post.kind === "standalone") {
    return { kind: post.kind, ...common };
  }

  if (post.kind === "quote") {
    return {
      kind: post.kind,
      ...common,
      referencedPostId: post.referencedPostId,
    };
  }

  const parent = await ctx.db.get("posts", post.parentPostId);
  if (parent === null) {
    return shouldNeverHappen("Reply parent missing");
  }

  const replyingTo =
    "state" in parent && parent.state === "deleted"
      ? { _tag: "tombstone" as const, postId: parent._id }
      : "kind" in parent && parent.kind === "repost"
        ? shouldNeverHappen("A Reply cannot target a Repost wrapper")
        : await toActiveParentView(ctx, parent);

  return {
    kind: post.kind,
    ...common,
    parentPostId: post.parentPostId,
    conversationRootId: post.conversationRootId,
    replyingTo,
  };
}

async function toActiveParentView(
  ctx: QueryCtx,
  post: Doc<"posts">,
): Promise<Extract<PostView, { kind: "reply" }>["replyingTo"]> {
  if (!("authorId" in post)) {
    return shouldNeverHappen("Active authored Post missing its author");
  }

  const authorOutcome = await getProfile(ctx, post.authorId);
  const author =
    authorOutcome._tag === "ok"
      ? authorOutcome.profile
      : shouldNeverHappen(
          "Post author missing; Member deletion is out of scope",
        );

  return { _tag: "active", postId: post._id, author };
}

function toTombstoneEntry(post: Doc<"posts">): ConversationEntry {
  if (!("kind" in post) || !("state" in post) || post.state !== "deleted") {
    return shouldNeverHappen("Only deleted authored Posts become tombstones");
  }

  const common = { postId: post._id, publishedAt: post._creationTime };
  if (post.kind === "standalone") {
    return { _tag: "tombstone", post: { kind: post.kind, ...common } };
  }
  if (post.kind === "quote") {
    return {
      _tag: "tombstone",
      post: {
        kind: post.kind,
        ...common,
        referencedPostId: post.referencedPostId,
      },
    };
  }
  if (post.kind === "reply") {
    return {
      _tag: "tombstone",
      post: {
        kind: post.kind,
        ...common,
        parentPostId: post.parentPostId,
        conversationRootId: post.conversationRootId,
      },
    };
  }
  return shouldNeverHappen("Repost wrappers never become tombstones");
}

async function toConversationEntry(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewerId: Doc<"members">["_id"] | null,
): Promise<ConversationEntry> {
  if ("state" in post && post.state === "deleted") {
    return toTombstoneEntry(post);
  }
  return { _tag: "active", post: await toPostView(ctx, post, viewerId) };
}

function mergeNewest(
  ...postPages: ReadonlyArray<ReadonlyArray<Doc<"posts">>>
): ReadonlyArray<Doc<"posts">> {
  return postPages
    .flat()
    .sort((left, right) => right._creationTime - left._creationTime)
    .slice(0, FEED_LIMIT + 1);
}

async function toBoundedList(
  ctx: QueryCtx,
  page: ReadonlyArray<Doc<"posts">>,
  viewerId: Doc<"members">["_id"] | null,
): Promise<PostList> {
  const posts = await Promise.all(
    page.slice(0, FEED_LIMIT).map((post) => toPostView(ctx, post, viewerId)),
  );

  return {
    posts,
    ending: page.length > FEED_LIMIT ? "truncated" : "complete",
  };
}

/**
 * Read the public Feed as complete Post display models.
 *
 * @param ctx - The Convex query context.
 * @returns The newest bounded collection of Posts and its list ending.
 */
export async function listFeed(ctx: QueryCtx): Promise<PostList> {
  const viewerId = await currentMemberId(ctx);
  const [explicitPosts, legacyPosts] = await Promise.all([
    ctx.db
      .query("posts")
      .withIndex("by_state_and_kind", (q) =>
        q.eq("state", "active").eq("kind", "standalone"),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
    ctx.db
      .query("posts")
      .withIndex("by_state_and_kind", (q) =>
        q.eq("state", undefined).eq("kind", undefined),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
  ]);
  const page = mergeNewest(explicitPosts, legacyPosts);

  return await toBoundedList(ctx, page, viewerId);
}

/**
 * Read one Member's Posts as complete display models.
 *
 * @param ctx - The Convex query context.
 * @param memberId - The Profile route's untrusted Member id segment.
 * @returns The Member's bounded Posts, or a missing-Member outcome.
 */
export async function listByMember(
  ctx: QueryCtx,
  memberId: string,
): Promise<ListByMemberOutcome> {
  const profile = await getProfile(ctx, memberId);

  if (profile._tag === "member-not-found") {
    return profile;
  }

  const viewerId = await currentMemberId(ctx);
  const [standalonePosts, replyPosts, quotePosts, legacyPosts] =
    await Promise.all([
      ctx.db
        .query("posts")
        .withIndex("by_authorId_and_state_and_kind", (q) =>
          q
            .eq("authorId", profile.profile.memberId)
            .eq("state", "active")
            .eq("kind", "standalone"),
        )
        .order("desc")
        .take(FEED_LIMIT + 1),
      ctx.db
        .query("posts")
        .withIndex("by_authorId_and_state_and_kind", (q) =>
          q
            .eq("authorId", profile.profile.memberId)
            .eq("state", "active")
            .eq("kind", "reply"),
        )
        .order("desc")
        .take(FEED_LIMIT + 1),
      ctx.db
        .query("posts")
        .withIndex("by_authorId_and_state_and_kind", (q) =>
          q
            .eq("authorId", profile.profile.memberId)
            .eq("state", "active")
            .eq("kind", "quote"),
        )
        .order("desc")
        .take(FEED_LIMIT + 1),
      ctx.db
        .query("posts")
        .withIndex("by_authorId_and_state_and_kind", (q) =>
          q
            .eq("authorId", profile.profile.memberId)
            .eq("state", undefined)
            .eq("kind", undefined),
        )
        .order("desc")
        .take(FEED_LIMIT + 1),
    ]);
  const page = mergeNewest(
    standalonePosts,
    replyPosts,
    quotePosts,
    legacyPosts,
  );

  return { _tag: "ok", ...(await toBoundedList(ctx, page, viewerId)) };
}

/**
 * Publish a Post authored by the authenticated Member.
 *
 * @param ctx - The Convex mutation context.
 * @param content - The untrusted composer draft.
 * @returns The published Post id or a precise expected failure.
 */
export async function create(
  ctx: MutationCtx,
  content: string,
): Promise<CreatePostOutcome> {
  const member = await ensureCurrent(ctx);

  if (member._tag === "unauthenticated") {
    return member;
  }

  const parsed = PostContent.parse(content);

  if (parsed._tag === "err") {
    return { _tag: "invalid-content", reason: parsed.error.reason };
  }

  const postId = await ctx.db.insert("posts", {
    state: "active",
    kind: "standalone",
    authorId: member.memberId,
    content: parsed.value,
    likeCount: 0,
    activeReplyCount: 0,
    activeRepostCount: 0,
  });

  return { _tag: "ok", postId };
}

/**
 * Publish a Reply and increment its direct parent's active Reply count.
 *
 * @param ctx - The Convex mutation context.
 * @param parentPostId - The selected direct parent.
 * @param content - The untrusted Reply draft.
 * @returns The Reply id or a precise expected failure.
 */
export async function createReply(
  ctx: MutationCtx,
  parentPostId: Doc<"posts">["_id"],
  content: string,
): Promise<CreateReplyOutcome> {
  const member = await ensureCurrent(ctx);
  if (member._tag === "unauthenticated") {
    return member;
  }

  const parsed = PostContent.parse(content);
  if (parsed._tag === "err") {
    return { _tag: "invalid-content", reason: parsed.error.reason };
  }

  const target = await ctx.db.get("posts", parentPostId);
  if (target === null) {
    return { _tag: "target-not-found" };
  }
  if ("state" in target && target.state === "deleted") {
    return { _tag: "target-deleted" };
  }
  if ("kind" in target && target.kind === "repost") {
    return { _tag: "target-is-repost" };
  }

  const conversationRootId =
    "kind" in target && target.kind === "reply"
      ? target.conversationRootId
      : target._id;

  if (!("kind" in target)) {
    await ctx.db.replace("posts", target._id, {
      state: "active",
      kind: "standalone",
      authorId: target.authorId,
      content: target.content,
      likeCount: target.likeCount,
      activeReplyCount: 1,
      activeRepostCount: 0,
    });
  } else {
    await ctx.db.patch("posts", target._id, {
      activeReplyCount: target.activeReplyCount + 1,
    });
  }

  const postId = await ctx.db.insert("posts", {
    state: "active",
    kind: "reply",
    authorId: member.memberId,
    content: parsed.value,
    likeCount: 0,
    activeReplyCount: 0,
    activeRepostCount: 0,
    parentPostId: target._id,
    conversationRootId,
  });

  return { _tag: "ok", postId };
}

/**
 * Resolve a stable authored Post URL into its bounded flat Conversation.
 *
 * @param ctx - The Convex query context.
 * @param postIdInput - The untrusted dynamic route segment.
 * @returns The Conversation or a missing-Post outcome.
 */
export async function getConversation(
  ctx: QueryCtx,
  postIdInput: string,
): Promise<GetConversationOutcome> {
  const postId = ctx.db.normalizeId("posts", postIdInput);
  if (postId === null) {
    return { _tag: "post-not-found" };
  }

  const requestedPost = await ctx.db.get("posts", postId);
  if (
    requestedPost === null ||
    ("kind" in requestedPost && requestedPost.kind === "repost")
  ) {
    return { _tag: "post-not-found" };
  }

  const rootId =
    "kind" in requestedPost && requestedPost.kind === "reply"
      ? requestedPost.conversationRootId
      : requestedPost._id;
  const rootPost = await ctx.db.get("posts", rootId);
  if (rootPost === null || ("kind" in rootPost && rootPost.kind === "repost")) {
    return shouldNeverHappen("Conversation root missing or invalid");
  }

  const latest = await ctx.db
    .query("posts")
    .withIndex("by_conversationRootId", (q) =>
      q.eq("conversationRootId", rootId),
    )
    .order("desc")
    .take(CONVERSATION_REPLY_LIMIT + 1);
  const newestVisible = latest.slice(0, CONVERSATION_REPLY_LIMIT);
  const requestedIsReply =
    "kind" in requestedPost && requestedPost.kind === "reply";
  const requestedIsVisible = newestVisible.some(
    (post) => post._id === requestedPost._id,
  );
  const selectedReplies =
    requestedIsReply && !requestedIsVisible
      ? [...newestVisible.slice(0, CONVERSATION_REPLY_LIMIT - 1), requestedPost]
      : newestVisible;
  const chronologicalReplies = [...selectedReplies].sort(
    (left, right) => left._creationTime - right._creationTime,
  );
  const viewerId = await currentMemberId(ctx);

  return {
    _tag: "ok",
    root: await toConversationEntry(ctx, rootPost, viewerId),
    replies: await Promise.all(
      chronologicalReplies.map(
        async (reply) => await toConversationEntry(ctx, reply, viewerId),
      ),
    ),
    requestedPostId: requestedPost._id,
    requestedReplyWasOutsideWindow: requestedIsReply && !requestedIsVisible,
    ending: latest.length > CONVERSATION_REPLY_LIMIT ? "truncated" : "complete",
  };
}

/**
 * Toggle the authenticated Member's Like on a Post.
 *
 * @param ctx - The Convex mutation context.
 * @param postId - The Post whose Like state is toggled.
 * @returns The new Like state and count, or a precise expected failure.
 */
export async function toggleLike(
  ctx: MutationCtx,
  postId: Doc<"posts">["_id"],
): Promise<ToggleLikeOutcome> {
  const member = await ensureCurrent(ctx);

  if (member._tag === "unauthenticated") {
    return member;
  }

  const post = await ctx.db.get("posts", postId);

  if (post === null) {
    return { _tag: "post-not-found" };
  }

  if (
    ("state" in post && post.state === "deleted") ||
    ("kind" in post && post.kind === "repost")
  ) {
    return { _tag: "post-not-found" };
  }

  const existing = await ctx.db
    .query("likes")
    .withIndex("by_postId_and_memberId", (q) =>
      q.eq("postId", post._id).eq("memberId", member.memberId),
    )
    .unique();

  if (existing === null) {
    await ctx.db.insert("likes", {
      memberId: member.memberId,
      postId: post._id,
    });
    const likeCount = post.likeCount + 1;
    await ctx.db.patch("posts", post._id, { likeCount });
    return { _tag: "ok", state: "liked", likeCount };
  }

  await ctx.db.delete("likes", existing._id);
  const likeCount = post.likeCount - 1;
  await ctx.db.patch("posts", post._id, { likeCount });
  return { _tag: "ok", state: "unliked", likeCount };
}

/**
 * Remove a Post authored by the authenticated Member and cascade its Likes.
 *
 * @param ctx - The Convex mutation context.
 * @param postId - The Post to remove.
 * @returns Success or a precise authentication, ownership, or lookup failure.
 */
export async function remove(
  ctx: MutationCtx,
  postId: Doc<"posts">["_id"],
): Promise<RemovePostOutcome> {
  const member = await ensureCurrent(ctx);

  if (member._tag === "unauthenticated") {
    return member;
  }

  const post = await ctx.db.get("posts", postId);

  if (post === null) {
    return { _tag: "post-not-found" };
  }

  if ("state" in post && post.state === "deleted") {
    return { _tag: "post-not-found" };
  }

  if (post.authorId !== member.memberId) {
    return { _tag: "forbidden" };
  }

  const likes = ctx.db
    .query("likes")
    .withIndex("by_postId_and_memberId", (q) => q.eq("postId", post._id));

  for await (const like of likes) {
    await ctx.db.delete("likes", like._id);
  }

  if ("kind" in post && post.kind === "repost") {
    await ctx.db.delete("posts", post._id);
    return { _tag: "ok" };
  }

  if ("kind" in post && post.kind === "reply") {
    const parent = await ctx.db.get("posts", post.parentPostId);
    if (parent !== null && "kind" in parent && parent.kind !== "repost") {
      await ctx.db.patch("posts", parent._id, {
        activeReplyCount: Math.max(0, parent.activeReplyCount - 1),
      });
    }
  }

  if (!("kind" in post)) {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: "standalone",
      activeReplyCount: 0,
      activeRepostCount: 0,
    });
  } else if (post.kind === "standalone") {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: post.activeRepostCount,
    });
  } else if (post.kind === "reply") {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: post.activeRepostCount,
      parentPostId: post.parentPostId,
      conversationRootId: post.conversationRootId,
    });
  } else {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: post.activeRepostCount,
      referencedPostId: post.referencedPostId,
    });
  }

  return { _tag: "ok" };
}
