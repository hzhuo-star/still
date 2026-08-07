import { v, type Infer } from "convex/values";

import { listEndingValidator } from "./list";
import {
  memberIdentityValidator,
  registrationRequiredOutcomeValidator,
} from "./member";

/** The maximum number of Posts a Feed or Profile renders. */
export const FEED_LIMIT = 50;

/** The maximum number of Replies a Conversation renders. */
export const CONVERSATION_REPLY_LIMIT = 50;

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
  /** Whether the current viewer has Reposted the Post. */
  viewerHasReposted: v.boolean(),
  /** Whether the current viewer may delete the Post. */
  viewerCanDelete: v.boolean(),
  /** Whether the current viewer may edit the Post's text. */
  viewerCanEdit: v.boolean(),
  /**
   * The Post's current optimistic-concurrency revision. An edit must submit
   * the revision it was prepared against.
   */
  revision: v.number(),
  /** When the Post was last edited; absent until its first edit. */
  editedAt: v.optional(v.number()),
  /** The Post author's projected public identity. */
  author: memberIdentityValidator,
} as const;

/** A shallow immediate-parent label for a Reply in a flat Conversation. */
export const replyParentViewValidator = v.union(
  v.object({
    _tag: v.literal("active"),
    postId: v.id("posts"),
    author: memberIdentityValidator,
  }),
  v.object({
    _tag: v.literal("tombstone"),
    postId: v.id("posts"),
  }),
);

/** A shallow immediate-parent label for a Reply in a flat Conversation. */
export type ReplyParentView = Readonly<Infer<typeof replyParentViewValidator>>;

const quoteTargetPreviewFields = {
  /** The directly referenced Post's canonical identifier. */
  postId: v.id("posts"),
  /** The referenced Post's current plain-text content. */
  content: v.string(),
  /** The referenced Post's original publication time. */
  publishedAt: v.number(),
  /** The referenced Post author's projected public identity. */
  author: memberIdentityValidator,
} as const;

/** One available shallow Quote target without recursive relationships. */
export const quoteTargetPreviewValidator = v.union(
  v.object({ kind: v.literal("standalone"), ...quoteTargetPreviewFields }),
  v.object({ kind: v.literal("reply"), ...quoteTargetPreviewFields }),
  v.object({ kind: v.literal("quote"), ...quoteTargetPreviewFields }),
);

/** One available shallow Quote target without recursive relationships. */
export type QuoteTargetPreview = Readonly<
  Infer<typeof quoteTargetPreviewValidator>
>;

/** The live shallow Quote target or its unavailable projection. */
export const quoteReferenceViewValidator = v.union(
  v.object({
    _tag: v.literal("available"),
    post: quoteTargetPreviewValidator,
  }),
  v.object({ _tag: v.literal("unavailable") }),
);

/** The live shallow Quote target or its unavailable projection. */
export type QuoteReferenceView = Readonly<
  Infer<typeof quoteReferenceViewValidator>
>;

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
  reference: quoteReferenceViewValidator,
});

/** The complete immutable display model for one active Standalone Post. */
export type StandalonePostView = Readonly<
  Infer<typeof standalonePostViewValidator>
>;

/** A complete immutable display model for one active authored Post. */
export const authoredPostViewValidator = v.union(
  standalonePostViewValidator,
  replyPostViewValidator,
  quotePostViewValidator,
);

/** A complete immutable display model for one active authored Post. */
export type AuthoredPostView = Readonly<
  Infer<typeof authoredPostViewValidator>
>;

/** The immutable display model for one Repost and its shallow source. */
export const repostPostViewValidator = v.object({
  /** The Repost wrapper's canonical identifier. */
  postId: v.id("posts"),
  /** The explicit distribution-record kind. */
  kind: v.literal("repost"),
  /** Repost time in milliseconds since the Unix epoch. */
  publishedAt: v.number(),
  /** Whether the current viewer may remove this Repost wrapper. */
  viewerCanRemove: v.boolean(),
  /** The reposter's projected public identity. */
  author: memberIdentityValidator,
  /** The live, non-recursive ultimate source display. */
  source: authoredPostViewValidator,
});

/** The immutable display model for one Repost and its shallow source. */
export type RepostPostView = Readonly<Infer<typeof repostPostViewValidator>>;

/** A complete immutable display model for one Feed or Profile item. */
export const postViewValidator = v.union(
  authoredPostViewValidator,
  repostPostViewValidator,
);

/** A complete immutable display model for one Feed or Profile item. */
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
  v.object({ _tag: v.literal("active"), post: authoredPostViewValidator }),
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
  registrationRequiredOutcomeValidator,
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
  registrationRequiredOutcomeValidator,
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

/** Arguments accepted when publishing a Quote Post or blank Repost. */
export const createQuoteArgsValidator = v.object({
  targetPostId: v.id("posts"),
  commentary: v.string(),
});

/** The outcome of publishing Quote commentary or delegating blank text. */
export const createQuoteOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    kind: v.literal("quote"),
    postId: v.id("posts"),
  }),
  v.object({
    _tag: v.literal("ok"),
    kind: v.literal("repost"),
    postId: v.id("posts"),
    activeRepostCount: v.number(),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("already-reposted") }),
  v.object({
    _tag: v.literal("invalid-content"),
    reason: v.literal("too-long"),
  }),
  v.object({ _tag: v.literal("target-not-found") }),
  v.object({ _tag: v.literal("target-deleted") }),
);

/** The outcome of publishing Quote commentary or delegating blank text. */
export type CreateQuoteOutcome = Readonly<
  Infer<typeof createQuoteOutcomeValidator>
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
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("post-not-found") }),
  v.object({ _tag: v.literal("post-unavailable") }),
);

/** The outcome of toggling the acting Member's Like on a Post. */
export type ToggleLikeOutcome = Readonly<
  Infer<typeof toggleLikeOutcomeValidator>
>;

/** The outcome of toggling the acting Member's Repost of an ultimate source. */
export const toggleRepostOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    /** The viewer's Repost state after the toggle. */
    state: v.union(v.literal("reposted"), v.literal("not-reposted")),
    /** The ultimate source's active Repost count after the toggle. */
    activeRepostCount: v.number(),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("post-not-found") }),
  v.object({ _tag: v.literal("post-unavailable") }),
);

/** The outcome of toggling the acting Member's Repost of an ultimate source. */
export type ToggleRepostOutcome = Readonly<
  Infer<typeof toggleRepostOutcomeValidator>
>;

/** Arguments accepted when editing an active text-bearing Post. */
export const editPostArgsValidator = v.object({
  /** The Post whose text is changing. */
  postId: v.id("posts"),
  /** The revision the editor prepared against; a stale value conflicts. */
  expectedRevision: v.number(),
  /** The replacement text; parsed under the existing Post content contract. */
  content: v.string(),
});

/** Arguments accepted when editing an active text-bearing Post. */
export type EditPostArgs = Readonly<Infer<typeof editPostArgsValidator>>;

/** Why a Post cannot carry an edit at all. */
export const notEditableReasonValidator = v.union(
  /** Deleted Posts keep only their structural Tombstone. */
  v.literal("deleted"),
  /** A Repost wrapper has no text of its own. */
  v.literal("repost"),
);

/** The outcome of editing an active text-bearing Post. */
export const editPostOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    /** The Post's revision after the edit. */
    revision: v.number(),
    /** When this edit was recorded. */
    editedAt: v.number(),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("post-not-found") }),
  v.object({ _tag: v.literal("not-author") }),
  v.object({
    _tag: v.literal("not-editable"),
    reason: notEditableReasonValidator,
  }),
  v.object({
    _tag: v.literal("invalid-content"),
    reason: v.union(v.literal("empty"), v.literal("too-long")),
  }),
  v.object({
    _tag: v.literal("edit-conflict"),
    /** The Post's current revision, which a retry must submit. */
    revision: v.number(),
    /**
     * The text the winning save stored. An editor needs to see it to choose
     * between keeping their draft and taking the newer wording; this is the
     * current body, not retained history.
     */
    content: v.string(),
  }),
);

/** The outcome of editing an active text-bearing Post. */
export type EditPostOutcome = Readonly<Infer<typeof editPostOutcomeValidator>>;

/** The outcome of removing a Post. */
export const removePostOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok") }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("forbidden") }),
  v.object({ _tag: v.literal("post-not-found") }),
);

/** The outcome of removing a Post. */
export type RemovePostOutcome = Readonly<
  Infer<typeof removePostOutcomeValidator>
>;
