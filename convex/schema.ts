import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

  posts: defineTable({
    /** The Member who published the Post. */
    authorId: v.id("members"),
    /** Parsed plain-text Post content (1–280 trimmed characters). */
    content: v.string(),
    /** Denormalized Like count maintained in the same mutations as `likes`. */
    likeCount: v.number(),
  }).index("by_authorId", ["authorId"]),

  likes: defineTable({
    /** The Member who Liked the Post. */
    memberId: v.id("members"),
    /** The Liked Post. */
    postId: v.id("posts"),
  }).index("by_postId_and_memberId", ["postId", "memberId"]),
});

export default schema;
