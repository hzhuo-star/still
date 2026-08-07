import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as PostContent from "../lib/postContent";
import {
  CONVERSATION_REPLY_LIMIT,
  FEED_LIMIT,
  type ConversationEntry,
  type CreatePostOutcome,
  type CreateQuoteOutcome,
  type CreateReplyOutcome,
  type EditPostOutcome,
  type GetConversationOutcome,
  type ListByMemberOutcome,
  type ListFollowingFeedOutcome,
  type AuthoredPostView,
  type PostList,
  type PostView,
  type QuoteReferenceView,
  type RemovePostOutcome,
  type ToggleLikeOutcome,
  type ToggleRepostOutcome,
} from "../contract/post";
import { byNewestFirst } from "../lib/postOrder";
import { shouldNeverHappen } from "../lib/result";
import { followedMemberIds } from "./follows";
import {
  currentMemberId,
  getIdentity,
  getProfile,
  requireCurrent,
} from "./members";

async function toPostView(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewerId: Doc<"members">["_id"] | null,
): Promise<PostView> {
  if (post.kind === "repost") {
    const source = await ctx.db.get("posts", post.sourcePostId);

    if (source === null) {
      return shouldNeverHappen(
        "Active Repost source missing; source removal must cascade wrappers",
      );
    }

    const author =
      (await getIdentity(ctx, post.authorId)) ??
      shouldNeverHappen(
        "Repost author missing; Member deletion is out of scope",
      );

    return {
      postId: post._id,
      kind: "repost",
      publishedAt: post._creationTime,
      viewerCanRemove: viewerId === post.authorId,
      author,
      source: await toAuthoredPostView(ctx, source, viewerId),
    };
  }

  return await toAuthoredPostView(ctx, post, viewerId);
}

/**
 * Project one active text-bearing Post into its complete display model.
 *
 * Shared with the Search model, whose results are always active authored
 * Posts; Repost wrappers and Tombstones never reach this projection.
 *
 * @param ctx - The Convex query context.
 * @param post - The stored active Standalone, Reply, or Quote Post.
 * @param viewerId - The viewing Member, or `null` for a signed-out reader.
 * @returns The Post's complete immutable display model with viewer state.
 */
export async function toAuthoredPostView(
  ctx: QueryCtx,
  post: Doc<"posts">,
  viewerId: Doc<"members">["_id"] | null,
): Promise<AuthoredPostView> {
  if (post.state === "deleted" || post.kind === "repost") {
    return shouldNeverHappen("Only active authored Posts have display models");
  }

  const author =
    (await getIdentity(ctx, post.authorId)) ??
    shouldNeverHappen("Post author missing; Member deletion is out of scope");

  const like =
    viewerId === null
      ? null
      : await ctx.db
          .query("likes")
          .withIndex("by_postId_and_memberId", (q) =>
            q.eq("postId", post._id).eq("memberId", viewerId),
          )
          .unique();

  const repost =
    viewerId === null
      ? null
      : await ctx.db
          .query("posts")
          .withIndex("by_sourcePostId_and_authorId", (q) =>
            q.eq("sourcePostId", post._id).eq("authorId", viewerId),
          )
          .unique();

  const common = {
    postId: post._id,
    content: post.content,
    publishedAt: post._creationTime,
    likeCount: post.likeCount,
    activeReplyCount: post.activeReplyCount,
    activeRepostCount: post.activeRepostCount,
    viewerHasLiked: like !== null,
    viewerHasReposted: repost !== null,
    viewerCanDelete: viewerId === post.authorId,
    viewerCanEdit: viewerId === post.authorId,
    revision: currentRevision(post),
    ...(post.editedAt === undefined ? {} : { editedAt: post.editedAt }),
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
      reference: await toQuoteReferenceView(ctx, post.referencedPostId),
    };
  }

  const parent = await ctx.db.get("posts", post.parentPostId);
  if (parent === null) {
    return shouldNeverHappen("Reply parent missing");
  }

  const replyingTo =
    parent.state === "deleted"
      ? { _tag: "tombstone" as const, postId: parent._id }
      : parent.kind === "repost"
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

async function toQuoteReferenceView(
  ctx: QueryCtx,
  referencedPostId: Doc<"posts">["_id"],
): Promise<QuoteReferenceView> {
  const post = await ctx.db.get("posts", referencedPostId);

  if (post === null || post.state === "deleted" || post.kind === "repost") {
    return { _tag: "unavailable" };
  }

  const author =
    (await getIdentity(ctx, post.authorId)) ??
    shouldNeverHappen(
      "Quote target author missing; Member deletion is out of scope",
    );
  const common = {
    postId: post._id,
    content: post.content,
    publishedAt: post._creationTime,
    author,
  };

  if (post.kind === "standalone") {
    return { _tag: "available", post: { kind: "standalone", ...common } };
  }
  if (post.kind === "reply") {
    return { _tag: "available", post: { kind: "reply", ...common } };
  }
  return { _tag: "available", post: { kind: "quote", ...common } };
}

async function toActiveParentView(
  ctx: QueryCtx,
  post: Doc<"posts">,
): Promise<Extract<PostView, { kind: "reply" }>["replyingTo"]> {
  if (!("authorId" in post)) {
    return shouldNeverHappen("Active authored Post missing its author");
  }

  const author =
    (await getIdentity(ctx, post.authorId)) ??
    shouldNeverHappen("Post author missing; Member deletion is out of scope");

  return { _tag: "active", postId: post._id, author };
}

function toTombstoneEntry(post: Doc<"posts">): ConversationEntry {
  if (post.state !== "deleted") {
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
  if (post.state === "deleted") {
    return toTombstoneEntry(post);
  }
  if (post.kind === "repost") {
    return shouldNeverHappen("Repost wrappers are not Conversation entries");
  }
  return {
    _tag: "active",
    post: await toAuthoredPostView(ctx, post, viewerId),
  };
}

function mergeNewest(
  ...postPages: ReadonlyArray<ReadonlyArray<Doc<"posts">>>
): ReadonlyArray<Doc<"posts">> {
  return postPages
    .flat()
    .sort(byNewestFirst)
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
  const [standalonePosts, quotePosts, reposts] = await Promise.all([
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
        q.eq("state", "active").eq("kind", "quote"),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
    ctx.db
      .query("posts")
      .withIndex("by_state_and_kind", (q) =>
        q.eq("state", "active").eq("kind", "repost"),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
  ]);
  const page = mergeNewest(standalonePosts, quotePosts, reposts);

  return await toBoundedList(ctx, page, viewerId);
}

/** The Post kinds a Feed entry may hold; Replies stay in Conversations. */
const FEED_ENTRY_KINDS = ["standalone", "quote", "repost"] as const;

/**
 * Read the acting Member's exact Following Feed as complete display models.
 *
 * The Feed is built at read time from bounded indexed ranges — one per Feed
 * kind for the viewer and each of their at most 50 followed Members — merged
 * newest-first under the shared 51-to-50 contract. Reading
 * the graph and the Posts in one query keeps Follow and Post changes
 * transactionally consistent and reactive without publish-time fan-out, and no
 * followed Member is ever sampled or omitted.
 *
 * @param ctx - The Convex query context.
 * @returns The viewer's bounded Following Feed, or the precise refusal that
 *   routes a signed-out or still-onboarding visitor to the missing step.
 */
export async function listFollowingFeed(
  ctx: QueryCtx,
): Promise<ListFollowingFeedOutcome> {
  const member = await requireCurrent(ctx);

  if (member._tag !== "ok") {
    return member;
  }

  const authorIds = [
    member.memberId,
    ...(await followedMemberIds(ctx, member.memberId)),
  ];
  const pages = await Promise.all(
    authorIds.flatMap((authorId) =>
      FEED_ENTRY_KINDS.map(
        async (kind) =>
          await ctx.db
            .query("posts")
            .withIndex("by_authorId_and_state_and_kind", (q) =>
              q.eq("authorId", authorId).eq("state", "active").eq("kind", kind),
            )
            .order("desc")
            .take(FEED_LIMIT + 1),
      ),
    ),
  );
  const page = mergeNewest(...pages);

  return { _tag: "ok", ...(await toBoundedList(ctx, page, member.memberId)) };
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
  const [standalonePosts, replyPosts, quotePosts, reposts] = await Promise.all([
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
          .eq("state", "active")
          .eq("kind", "repost"),
      )
      .order("desc")
      .take(FEED_LIMIT + 1),
  ]);
  const page = mergeNewest(standalonePosts, replyPosts, quotePosts, reposts);

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
  const member = await requireCurrent(ctx);

  if (member._tag !== "ok") {
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
    revision: 0,
    likeCount: 0,
    activeReplyCount: 0,
    activeRepostCount: 0,
  });

  return { _tag: "ok", postId };
}

/**
 * Read a text-bearing Post's current revision.
 *
 * Posts published before the social expansion carry no revision, so they start
 * at zero and an editor prepared against zero is not stale.
 */
function currentRevision(post: EngagementPostRecord): number {
  return post.revision ?? 0;
}

type RepostRecord = Extract<Doc<"posts">, { readonly kind: "repost" }>;
type DeletedPostRecord = Extract<Doc<"posts">, { readonly state: "deleted" }>;
type EngagementPostRecord = Exclude<
  Doc<"posts">,
  RepostRecord | DeletedPostRecord
>;

type ActionTargetOutcome =
  | { readonly _tag: "ok"; readonly post: EngagementPostRecord }
  | { readonly _tag: "post-not-found" }
  | { readonly _tag: "post-unavailable" };

async function resolveActionTarget(
  ctx: MutationCtx,
  postId: Doc<"posts">["_id"],
): Promise<ActionTargetOutcome> {
  const selected = await ctx.db.get("posts", postId);

  if (selected === null) {
    return { _tag: "post-not-found" };
  }

  let source = selected;
  const visited = new Set<Doc<"posts">["_id"]>();

  while (source.kind === "repost") {
    if (visited.has(source._id)) {
      return shouldNeverHappen("Repost source chain contains a cycle");
    }
    visited.add(source._id);

    const next = await ctx.db.get("posts", source.sourcePostId);
    if (next === null) {
      return { _tag: "post-not-found" };
    }
    source = next;
  }

  if (source.state === "deleted") {
    return { _tag: "post-unavailable" };
  }

  return { _tag: "ok", post: source };
}

async function createRepostIfMissing(
  ctx: MutationCtx,
  source: EngagementPostRecord,
  authorId: Doc<"members">["_id"],
): Promise<
  | {
      readonly _tag: "ok";
      readonly postId: Doc<"posts">["_id"];
      readonly activeRepostCount: number;
    }
  | { readonly _tag: "already-reposted" }
> {
  const existing = await findRepost(ctx, source._id, authorId);

  if (existing !== null) {
    return { _tag: "already-reposted" };
  }

  return { _tag: "ok", ...(await createRepost(ctx, source, authorId)) };
}

async function findRepost(
  ctx: MutationCtx,
  sourcePostId: Doc<"posts">["_id"],
  authorId: Doc<"members">["_id"],
): Promise<RepostRecord | null> {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_sourcePostId_and_authorId", (q) =>
      q.eq("sourcePostId", sourcePostId).eq("authorId", authorId),
    )
    .unique();

  if (post === null || post.kind === "repost") {
    return post;
  }

  return shouldNeverHappen("Only Reposts may have a source Post id");
}

async function createRepost(
  ctx: MutationCtx,
  source: EngagementPostRecord,
  authorId: Doc<"members">["_id"],
): Promise<{
  readonly postId: Doc<"posts">["_id"];
  readonly activeRepostCount: number;
}> {
  const postId = await ctx.db.insert("posts", {
    state: "active",
    kind: "repost",
    authorId,
    sourcePostId: source._id,
  });
  const activeRepostCount = source.activeRepostCount + 1;
  await ctx.db.patch("posts", source._id, { activeRepostCount });

  return { postId, activeRepostCount };
}

/**
 * Publish Quote commentary or delegate a blank draft to Repost creation.
 *
 * @param ctx - The Convex mutation context.
 * @param targetPostId - The selected Post, normalized through Repost wrappers.
 * @param commentary - The optional Quote commentary draft.
 * @returns The created Quote or Repost id, or a precise expected failure.
 */
export async function createQuote(
  ctx: MutationCtx,
  targetPostId: Doc<"posts">["_id"],
  commentary: string,
): Promise<CreateQuoteOutcome> {
  const member = await requireCurrent(ctx);
  if (member._tag !== "ok") {
    return member;
  }

  const target = await resolveActionTarget(ctx, targetPostId);
  if (target._tag === "post-not-found") {
    return { _tag: "target-not-found" };
  }
  if (target._tag === "post-unavailable") {
    return { _tag: "target-deleted" };
  }

  if (commentary.trim().length === 0) {
    const result = await createRepostIfMissing(
      ctx,
      target.post,
      member.memberId,
    );
    return result._tag === "already-reposted"
      ? result
      : {
          _tag: "ok",
          kind: "repost",
          postId: result.postId,
          activeRepostCount: result.activeRepostCount,
        };
  }

  const parsed = PostContent.parse(commentary);
  if (parsed._tag === "err") {
    return { _tag: "invalid-content", reason: "too-long" };
  }

  const postId = await ctx.db.insert("posts", {
    state: "active",
    kind: "quote",
    authorId: member.memberId,
    content: parsed.value,
    revision: 0,
    likeCount: 0,
    activeReplyCount: 0,
    activeRepostCount: 0,
    referencedPostId: target.post._id,
  });

  return { _tag: "ok", kind: "quote", postId };
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
  const member = await requireCurrent(ctx);
  if (member._tag !== "ok") {
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
  if (target.state === "deleted") {
    return { _tag: "target-deleted" };
  }
  if (target.kind === "repost") {
    return { _tag: "target-is-repost" };
  }

  const conversationRootId =
    target.kind === "reply" ? target.conversationRootId : target._id;

  await ctx.db.patch("posts", target._id, {
    activeReplyCount: target.activeReplyCount + 1,
  });

  const postId = await ctx.db.insert("posts", {
    state: "active",
    kind: "reply",
    authorId: member.memberId,
    content: parsed.value,
    revision: 0,
    likeCount: 0,
    activeReplyCount: 0,
    activeRepostCount: 0,
    parentPostId: target._id,
    conversationRootId,
  });

  return { _tag: "ok", postId };
}

/**
 * Replace the text of an active Post the acting Member authored.
 *
 * The submitted revision is compared and incremented inside the same
 * transaction as the write, so two editors working from one revision cannot
 * both succeed: the loser receives the current revision and can reload. Nothing
 * else about the Post changes — its id, kind, author, creation time,
 * relationships, engagement, and Feed position are all untouched, and only the
 * current body is stored.
 *
 * @param ctx - The Convex mutation context.
 * @param postId - The Post whose text is changing.
 * @param expectedRevision - The revision the editor prepared against.
 * @param content - The untrusted replacement text.
 * @returns The new revision and edit time, or a precise expected failure.
 */
export async function edit(
  ctx: MutationCtx,
  postId: Doc<"posts">["_id"],
  expectedRevision: number,
  content: string,
): Promise<EditPostOutcome> {
  const member = await requireCurrent(ctx);
  if (member._tag !== "ok") {
    return member;
  }

  const post = await ctx.db.get("posts", postId);
  if (post === null) {
    return { _tag: "post-not-found" };
  }
  if (post.state === "deleted") {
    return { _tag: "not-editable", reason: "deleted" };
  }
  if (post.kind === "repost") {
    return { _tag: "not-editable", reason: "repost" };
  }
  if (post.authorId !== member.memberId) {
    return { _tag: "not-author" };
  }

  const parsed = PostContent.parse(content);
  if (parsed._tag === "err") {
    return { _tag: "invalid-content", reason: parsed.error.reason };
  }

  const revision = currentRevision(post);
  if (revision !== expectedRevision) {
    return { _tag: "edit-conflict", revision, content: post.content };
  }

  const editedAt = Date.now();
  await ctx.db.patch("posts", post._id, {
    content: parsed.value,
    revision: revision + 1,
    editedAt,
  });

  return { _tag: "ok", revision: revision + 1, editedAt };
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
  if (requestedPost === null || requestedPost.kind === "repost") {
    return { _tag: "post-not-found" };
  }

  const rootId =
    requestedPost.kind === "reply"
      ? requestedPost.conversationRootId
      : requestedPost._id;
  const rootPost = await ctx.db.get("posts", rootId);
  if (rootPost === null || rootPost.kind === "repost") {
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
  const requestedIsReply = requestedPost.kind === "reply";
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
  const member = await requireCurrent(ctx);

  if (member._tag !== "ok") {
    return member;
  }

  const target = await resolveActionTarget(ctx, postId);

  if (target._tag !== "ok") {
    return target;
  }
  const post = target.post;

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
 * Toggle the authenticated Member's Repost of an ultimate source.
 *
 * @param ctx - The Convex mutation context.
 * @param postId - The selected Post, normalized before persistence.
 * @returns The new Repost state and count, or a precise expected failure.
 */
export async function toggleRepost(
  ctx: MutationCtx,
  postId: Doc<"posts">["_id"],
): Promise<ToggleRepostOutcome> {
  const member = await requireCurrent(ctx);

  if (member._tag !== "ok") {
    return member;
  }

  const target = await resolveActionTarget(ctx, postId);

  if (target._tag !== "ok") {
    return target;
  }
  const source = target.post;

  const existing = await findRepost(ctx, source._id, member.memberId);
  const currentCount = source.activeRepostCount;

  if (existing !== null) {
    await ctx.db.delete("posts", existing._id);
    const activeRepostCount = currentCount - 1;
    if (activeRepostCount < 0) {
      return shouldNeverHappen("Active Repost count cannot become negative");
    }
    await ctx.db.patch("posts", source._id, { activeRepostCount });
    return { _tag: "ok", state: "not-reposted", activeRepostCount };
  }

  const { activeRepostCount } = await createRepost(
    ctx,
    source,
    member.memberId,
  );

  return { _tag: "ok", state: "reposted", activeRepostCount };
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
  const member = await requireCurrent(ctx);

  if (member._tag !== "ok") {
    return member;
  }

  const post = await ctx.db.get("posts", postId);

  if (post === null) {
    return { _tag: "post-not-found" };
  }

  if (post.state === "deleted") {
    return { _tag: "post-not-found" };
  }

  if (post.authorId !== member.memberId) {
    return { _tag: "forbidden" };
  }

  if (post.kind === "repost") {
    const source = await ctx.db.get("posts", post.sourcePostId);
    await ctx.db.delete("posts", post._id);

    if (source !== null && source.kind !== "repost") {
      const activeRepostCount = source.activeRepostCount - 1;
      if (activeRepostCount < 0) {
        return shouldNeverHappen("Active Repost count cannot become negative");
      }
      await ctx.db.patch("posts", source._id, { activeRepostCount });
    }

    return { _tag: "ok" };
  }

  const likes = ctx.db
    .query("likes")
    .withIndex("by_postId_and_memberId", (q) => q.eq("postId", post._id));

  for await (const like of likes) {
    await ctx.db.delete("likes", like._id);
  }

  if (post.kind === "reply") {
    const parent = await ctx.db.get("posts", post.parentPostId);
    if (parent !== null && parent.kind !== "repost") {
      if (parent.activeReplyCount <= 0) {
        return shouldNeverHappen("Reply parent count cannot fall below zero");
      }
      await ctx.db.patch("posts", parent._id, {
        activeReplyCount: parent.activeReplyCount - 1,
      });
    }
  }

  const reposts = ctx.db
    .query("posts")
    .withIndex("by_sourcePostId_and_authorId", (q) =>
      q.eq("sourcePostId", post._id),
    );

  for await (const repost of reposts) {
    await ctx.db.delete("posts", repost._id);
  }

  if (post.kind === "standalone") {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: 0,
    });
  } else if (post.kind === "reply") {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: 0,
      parentPostId: post.parentPostId,
      conversationRootId: post.conversationRootId,
    });
  } else {
    await ctx.db.replace("posts", post._id, {
      state: "deleted",
      kind: post.kind,
      activeReplyCount: post.activeReplyCount,
      activeRepostCount: 0,
      referencedPostId: post.referencedPostId,
    });
  }

  return { _tag: "ok" };
}
