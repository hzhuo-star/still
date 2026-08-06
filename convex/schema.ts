import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const legacyStandalonePostValidator = v.object({
  /** The Member who published the legacy Standalone Post. */
  authorId: v.id("members"),
  /** Parsed plain-text Post content (1–280 trimmed characters). */
  content: v.string(),
  /** Denormalized Like count maintained in the same mutations as `likes`. */
  likeCount: v.number(),
});

const activeStandalonePostValidator = v.object({
  state: v.literal("active"),
  kind: v.literal("standalone"),
  authorId: v.id("members"),
  content: v.string(),
  likeCount: v.number(),
  activeReplyCount: v.number(),
  activeRepostCount: v.number(),
});

const activeReplyPostValidator = v.object({
  state: v.literal("active"),
  kind: v.literal("reply"),
  authorId: v.id("members"),
  content: v.string(),
  likeCount: v.number(),
  activeReplyCount: v.number(),
  activeRepostCount: v.number(),
  parentPostId: v.id("posts"),
  conversationRootId: v.id("posts"),
});

const activeQuotePostValidator = v.object({
  state: v.literal("active"),
  kind: v.literal("quote"),
  authorId: v.id("members"),
  content: v.string(),
  likeCount: v.number(),
  activeReplyCount: v.number(),
  activeRepostCount: v.number(),
  referencedPostId: v.id("posts"),
});

const activeRepostValidator = v.object({
  state: v.literal("active"),
  kind: v.literal("repost"),
  authorId: v.id("members"),
  sourcePostId: v.id("posts"),
});

const postRecordValidator = v.union(
  legacyStandalonePostValidator,
  activeStandalonePostValidator,
  activeReplyPostValidator,
  activeQuotePostValidator,
  activeRepostValidator,
);

/**
 * Persistence schema for Still.
 *
 * `members` projects Clerk identities, `posts` stores published Posts with a
 * transactionally maintained Like count, and `likes` records at most one
 * Member/Post pair enforced through `by_postId_and_memberId` lookups inside
 * the Posts module.
 */
const schema = defineSchema({
  members: defineTable({
    /** Stable Clerk token identifier used as the external identity key. */
    externalId: v.string(),
    /** Display name projected from Clerk when the Member last entered. */
    displayName: v.string(),
    /** Avatar URL projected from Clerk, when one exists. */
    avatarUrl: v.optional(v.string()),
  }).index("by_externalId", ["externalId"]),

  posts: defineTable(postRecordValidator)
    .index("by_authorId", ["authorId"])
    .index("by_state_and_kind", ["state", "kind"])
    .index("by_authorId_and_state_and_kind", ["authorId", "state", "kind"]),

  likes: defineTable({
    /** The Member who Liked the Post. */
    memberId: v.id("members"),
    /** The Liked Post. */
    postId: v.id("posts"),
  }).index("by_postId_and_memberId", ["postId", "memberId"]),
});

export default schema;
