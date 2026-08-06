import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as PostContent from "../lib/postContent";
import {
  FEED_LIMIT,
  type CreatePostOutcome,
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

  if (post.kind !== "standalone") {
    return shouldNeverHappen(
      `Only Standalone Posts are readable before their vertical slice; received ${post.kind}`,
    );
  }

  return {
    postId: post._id,
    kind: post.kind,
    content: post.content,
    publishedAt: post._creationTime,
    likeCount: post.likeCount,
    activeReplyCount: post.activeReplyCount,
    activeRepostCount: post.activeRepostCount,
    viewerHasLiked: like !== null,
    viewerCanDelete: viewerId === post.authorId,
    author,
  };
}

function mergeNewest(
  explicitPosts: ReadonlyArray<Doc<"posts">>,
  legacyPosts: ReadonlyArray<Doc<"posts">>,
): ReadonlyArray<Doc<"posts">> {
  return [...explicitPosts, ...legacyPosts]
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
  const [explicitPosts, legacyPosts] = await Promise.all([
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
          .eq("state", undefined)
          .eq("kind", undefined),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
  ]);
  const page = mergeNewest(explicitPosts, legacyPosts);

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

  if ("kind" in post && post.kind === "repost") {
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

  if (post.authorId !== member.memberId) {
    return { _tag: "forbidden" };
  }

  const likes = ctx.db
    .query("likes")
    .withIndex("by_postId_and_memberId", (q) => q.eq("postId", post._id));

  for await (const like of likes) {
    await ctx.db.delete("likes", like._id);
  }

  await ctx.db.delete("posts", post._id);

  return { _tag: "ok" };
}
