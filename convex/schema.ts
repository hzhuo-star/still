import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const activeAuthoredPostValidator = v.object({
  state: v.literal("active"),
  authorId: v.id("members"),
  content: v.string(),
  /** Optimistic-concurrency token; absent only on pre-expansion records. */
  revision: v.optional(v.number()),
  /** Last successful edit time; absent until the first edit. */
  editedAt: v.optional(v.number()),
  likeCount: v.number(),
  activeReplyCount: v.number(),
  activeRepostCount: v.number(),
});

const activeStandalonePostValidator = activeAuthoredPostValidator.extend({
  kind: v.literal("standalone"),
});

const activeReplyPostValidator = activeAuthoredPostValidator.extend({
  kind: v.literal("reply"),
  parentPostId: v.id("posts"),
  conversationRootId: v.id("posts"),
});

const activeQuotePostValidator = activeAuthoredPostValidator.extend({
  kind: v.literal("quote"),
  referencedPostId: v.id("posts"),
});

const activeRepostValidator = v.object({
  state: v.literal("active"),
  kind: v.literal("repost"),
  authorId: v.id("members"),
  sourcePostId: v.id("posts"),
});

const postTombstoneValidator = v.object({
  state: v.literal("deleted"),
  activeReplyCount: v.number(),
  activeRepostCount: v.number(),
});

const standalonePostTombstoneValidator = postTombstoneValidator.extend({
  kind: v.literal("standalone"),
});

const replyPostTombstoneValidator = postTombstoneValidator.extend({
  kind: v.literal("reply"),
  parentPostId: v.id("posts"),
  conversationRootId: v.id("posts"),
});

const quotePostTombstoneValidator = postTombstoneValidator.extend({
  kind: v.literal("quote"),
  referencedPostId: v.id("posts"),
});

const postRecordValidator = v.union(
  activeStandalonePostValidator,
  activeReplyPostValidator,
  activeQuotePostValidator,
  activeRepostValidator,
  standalonePostTombstoneValidator,
  replyPostTombstoneValidator,
  quotePostTombstoneValidator,
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
    /** Registration lifecycle; absent only on pre-expansion records. */
    registrationState: v.optional(
      v.union(v.literal("pending"), v.literal("registered")),
    ),
    /** Public Handle preserving the Member's chosen lowercase spelling. */
    handle: v.optional(v.string()),
    /** Case-insensitive Handle key used for authoritative ownership. */
    normalizedHandle: v.optional(v.string()),
    /** Optional Still-owned public biography. */
    biography: v.optional(v.string()),
    /** Transactionally maintained public follower count. */
    followerCount: v.optional(v.number()),
    /** Transactionally maintained public following count. */
    followingCount: v.optional(v.number()),
    /** Normalized Handle and display-name projection for full-text Search. */
    searchText: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_normalizedHandle", ["normalizedHandle"])
    .searchIndex("search_searchText", {
      searchField: "searchText",
    }),

  posts: defineTable(postRecordValidator)
    .index("by_authorId", ["authorId"])
    .index("by_state_and_kind", ["state", "kind"])
    .index("by_authorId_and_state_and_kind", ["authorId", "state", "kind"])
    .index("by_conversationRootId", ["conversationRootId"])
    .index("by_sourcePostId_and_authorId", ["sourcePostId", "authorId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["state", "kind"],
    }),

  follows: defineTable({
    /** The Member choosing to receive another Member's Posts. */
    followerId: v.id("members"),
    /** The Member whose eligible Posts enter the follower's Following Feed. */
    followedId: v.id("members"),
  })
    .index("by_followerId", ["followerId"])
    .index("by_followedId", ["followedId"])
    .index("by_followerId_and_followedId", ["followerId", "followedId"]),

  likes: defineTable({
    /** The Member who Liked the Post. */
    memberId: v.id("members"),
    /** The Liked Post. */
    postId: v.id("posts"),
  }).index("by_postId_and_memberId", ["postId", "memberId"]),
});

export default schema;
