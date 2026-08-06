import { v, type Infer } from "convex/values";

import { memberProfileValidator } from "./member";

/** The maximum number of Posts a Feed or Profile renders. */
export const FEED_LIMIT = 50;

/** The maximum number of Replies a Conversation renders. */
export const CONVERSATION_REPLY_LIMIT = 50;

/** Whether a Post list contains every available Post or only the newest 50. */
export const listEndingValidator = v.union(
  v.literal("complete"),
  v.literal("truncated"),
);

/** Whether a Post list contains every available Post or only the newest 50. */
export type ListEnding = Infer<typeof listEndingValidator>;

const postViewFields = {
  /** The Post's canonical identifier. */
  postId: v.id("posts"),
  /** Parsed plain-text Post content with internal line breaks preserved. */
  content: v.string(),
  /** Server creation time in milliseconds since the Unix epoch. */
  publishedAt: v.number(),
  /** The Post's current Like count. */
  likeCount: v.number(),
  /** The number of active direct Replies to this Post. */
  activeReplyCount: v.number(),
  /** The number of active Reposts of this Post. */
  activeRepostCount: v.number(),
  /** Whether the current viewer has Liked the Post. */
  viewerHasLiked: v.boolean(),
  /** Whether the current viewer may delete the Post. */
  viewerCanDelete: v.boolean(),
  /** The Post author's projected public identity. */
  author: memberProfileValidator,
} as const;

/** A shallow immediate-parent label for a Reply in a flat Conversation. */
export const replyParentViewValidator = v.union(
  v.object({
    _tag: v.literal("active"),
    postId: v.id("posts"),
    author: memberProfileValidator,
  }),
  v.object({
    _tag: v.literal("tombstone"),
    postId: v.id("posts"),
  }),
);

/** A shallow immediate-parent label for a Reply in a flat Conversation. */
export type ReplyParentView = Readonly<Infer<typeof replyParentViewValidator>>;

const standalonePostViewValidator = v.object({
  kind: v.literal("standalone"),
  ...postViewFields,
});

const replyPostViewValidator = v.object({
  kind: v.literal("reply"),
  ...postViewFields,
  parentPostId: v.id("posts"),
  conversationRootId: v.id("posts"),
  replyingTo: replyParentViewValidator,
});

const quotePostViewValidator = v.object({
  kind: v.literal("quote"),
  ...postViewFields,
  referencedPostId: v.id("posts"),
});

/** The complete immutable display model for one active authored Post. */
export const postViewValidator = v.union(
  standalonePostViewValidator,
  replyPostViewValidator,
  quotePostViewValidator,
);

/** The complete immutable display model for one active authored Post. */
export type PostView = Readonly<Infer<typeof postViewValidator>>;

const standaloneTombstoneViewValidator = v.object({
  kind: v.literal("standalone"),
  postId: v.id("posts"),
  publishedAt: v.number(),
});

const replyTombstoneViewValidator = v.object({
  kind: v.literal("reply"),
  postId: v.id("posts"),
  publishedAt: v.number(),
  parentPostId: v.id("posts"),
  conversationRootId: v.id("posts"),
});

const quoteTombstoneViewValidator = v.object({
  kind: v.literal("quote"),
  postId: v.id("posts"),
  publishedAt: v.number(),
  referencedPostId: v.id("posts"),
});

/** An author-free, content-free Post Tombstone used only in Conversations. */
export const postTombstoneViewValidator = v.union(
  standaloneTombstoneViewValidator,
  replyTombstoneViewValidator,
  quoteTombstoneViewValidator,
);

/** An author-free, content-free Post Tombstone used only in Conversations. */
export type PostTombstoneView = Readonly<
  Infer<typeof postTombstoneViewValidator>
>;

/** One active Post or structural Post Tombstone in a Conversation. */
export const conversationEntryValidator = v.union(
  v.object({ _tag: v.literal("active"), post: postViewValidator }),
  v.object({ _tag: v.literal("tombstone"), post: postTombstoneViewValidator }),
);

/** One active Post or structural Post Tombstone in a Conversation. */
export type ConversationEntry = Readonly<
  Infer<typeof conversationEntryValidator>
>;

/** A bounded collection of complete Post display models. */
export const postListValidator = v.object({
  /** The newest Posts selected for the Feed or Profile. */
  posts: v.array(postViewValidator),
  /** Whether older Posts exist beyond the bounded collection. */
  ending: listEndingValidator,
});

/** A bounded collection of complete Post display models. */
export type PostList = Readonly<Infer<typeof postListValidator>>;

/** The outcome of reading one Member's bounded Post collection. */
export const listByMemberOutcomeValidator = v.union(
  postListValidator.extend({ _tag: v.literal("ok") }),
  v.object({ _tag: v.literal("member-not-found") }),
);

/** The outcome of reading one Member's bounded Post collection. */
export type ListByMemberOutcome = Readonly<
  Infer<typeof listByMemberOutcomeValidator>
>;

/** The outcome of publishing a Post. */
export const createPostOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok"), postId: v.id("posts") }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({
    _tag: v.literal("invalid-content"),
    /** Why the composer draft could not become Post content. */
    reason: v.union(v.literal("empty"), v.literal("too-long")),
  }),
);

/** The outcome of publishing a Post. */
export type CreatePostOutcome = Readonly<
  Infer<typeof createPostOutcomeValidator>
>;

/** Arguments accepted when publishing a Reply. */
export const createReplyArgsValidator = v.object({
  parentPostId: v.id("posts"),
  content: v.string(),
});

/** The outcome of publishing a Reply to an eligible Post. */
export const createReplyOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok"), postId: v.id("posts") }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({
    _tag: v.literal("invalid-content"),
    reason: v.union(v.literal("empty"), v.literal("too-long")),
  }),
  v.object({ _tag: v.literal("target-not-found") }),
  v.object({ _tag: v.literal("target-deleted") }),
  v.object({ _tag: v.literal("target-is-repost") }),
);

/** The outcome of publishing a Reply to an eligible Post. */
export type CreateReplyOutcome = Readonly<
  Infer<typeof createReplyOutcomeValidator>
>;

/** A bounded, flat Conversation resolved from any stable authored Post URL. */
export const conversationValidator = v.object({
  root: conversationEntryValidator,
  replies: v.array(conversationEntryValidator),
  requestedPostId: v.id("posts"),
  requestedReplyWasOutsideWindow: v.boolean(),
  ending: listEndingValidator,
});

/** A bounded, flat Conversation resolved from any stable authored Post URL. */
export type Conversation = Readonly<Infer<typeof conversationValidator>>;

/** The outcome of resolving a stable Conversation URL. */
export const getConversationOutcomeValidator = v.union(
  conversationValidator.extend({ _tag: v.literal("ok") }),
  v.object({ _tag: v.literal("post-not-found") }),
);

/** The outcome of resolving a stable Conversation URL. */
export type GetConversationOutcome = Readonly<
  Infer<typeof getConversationOutcomeValidator>
>;

/** Arguments accepted when resolving a stable Conversation route. */
export const getConversationArgsValidator = v.object({
  postId: v.string(),
});

/** The outcome of toggling the acting Member's Like on a Post. */
export const toggleLikeOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    /** The viewer's Like state after the toggle. */
    state: v.union(v.literal("liked"), v.literal("unliked")),
    /** The Post's Like count after the toggle. */
    likeCount: v.number(),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({ _tag: v.literal("post-not-found") }),
);

/** The outcome of toggling the acting Member's Like on a Post. */
export type ToggleLikeOutcome = Readonly<
  Infer<typeof toggleLikeOutcomeValidator>
>;

/** The outcome of removing a Post. */
export const removePostOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok") }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({ _tag: v.literal("forbidden") }),
  v.object({ _tag: v.literal("post-not-found") }),
);

/** The outcome of removing a Post. */
export type RemovePostOutcome = Readonly<
  Infer<typeof removePostOutcomeValidator>
>;
