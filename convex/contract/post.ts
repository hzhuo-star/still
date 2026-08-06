import { v, type Infer } from "convex/values";

import { memberProfileValidator } from "./member";

/** The maximum number of Posts a Feed or Profile renders. */
export const FEED_LIMIT = 50;

/** Whether a Post list contains every available Post or only the newest 50. */
export const listEndingValidator = v.union(
  v.literal("complete"),
  v.literal("truncated"),
);

/** Whether a Post list contains every available Post or only the newest 50. */
export type ListEnding = Infer<typeof listEndingValidator>;

/** The complete immutable display model for one Post. */
export const postViewValidator = v.object({
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
  author: memberProfileValidator,
});

/** The complete immutable display model for one Post. */
export type PostView = Readonly<Infer<typeof postViewValidator>>;

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
