import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  MAX_FOLLOWING,
  RELATIONSHIP_LIMIT,
  type ListRelationshipOutcome,
  type MemberSummary,
  type ToggleFollowOutcome,
  type ViewerFollow,
} from "../contract/member";
import { shouldNeverHappen } from "../lib/result";
import {
  asRegistered,
  followCounts,
  toMemberSummary,
  type RegisteredMemberRecord,
} from "./memberProjection";

/** The acting Member of a Follow operation, or why there is none. */
type ActingMember =
  | { readonly _tag: "ok"; readonly member: RegisteredMemberRecord }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "registration-required" };

function findRelation(
  ctx: QueryCtx,
  followerId: Id<"members">,
  followedId: Id<"members">,
): Promise<Doc<"follows"> | null> {
  return ctx.db
    .query("follows")
    .withIndex("by_followerId_and_followedId", (q) =>
      q.eq("followerId", followerId).eq("followedId", followedId),
    )
    .unique();
}

/**
 * Read the viewer's own Follow relationship to one Member.
 *
 * @param ctx - The Convex query context.
 * @param acting - The acting Member, or why the viewer cannot hold a relation.
 * @param member - The Member whose Profile is being read.
 * @returns The relationship the Follow control should present.
 */
export function viewerFollow(
  ctx: QueryCtx,
  acting: ActingMember,
  member: Doc<"members">,
): Promise<ViewerFollow> {
  if (acting._tag !== "ok" || asRegistered(member) === null) {
    return Promise.resolve("unavailable");
  }

  if (acting.member._id === member._id) {
    return Promise.resolve("self");
  }

  return findRelation(ctx, acting.member._id, member._id).then((relation) =>
    relation === null ? "not-following" : "following",
  );
}

/**
 * Follow or unfollow another registered Member as the acting Member.
 *
 * The relation, both counters, and the outgoing limit are read and written in
 * one transaction, so a retried or concurrent toggle can never leave two
 * relations, a counter that disagrees with the graph, or a 51st outgoing
 * Follow. Counters are recomputed from the relation that actually changed
 * rather than assumed, so an already-removed relation cannot push a count below
 * the true graph.
 *
 * @param ctx - The Convex mutation context.
 * @param acting - The acting Member, or why the operation cannot run.
 * @param followedMemberId - The Member being followed or unfollowed.
 * @returns The new relationship and both counts, or a precise failure.
 */
export async function toggle(
  ctx: MutationCtx,
  acting: ActingMember,
  followedMemberId: Id<"members">,
): Promise<ToggleFollowOutcome> {
  if (acting._tag !== "ok") {
    return acting;
  }

  const follower = acting.member;
  const followed = await ctx.db.get("members", followedMemberId);

  if (followed === null) {
    return { _tag: "member-not-found" };
  }

  if (followed._id === follower._id) {
    return { _tag: "self-follow" };
  }

  if (asRegistered(followed) === null) {
    return { _tag: "member-not-registered" };
  }

  const relation = await findRelation(ctx, follower._id, followed._id);

  if (relation !== null) {
    await ctx.db.delete("follows", relation._id);

    return {
      _tag: "ok",
      state: "not-following",
      ...(await refreshCounts(ctx, follower._id, followed._id)),
    };
  }

  if (followCounts(follower).followingCount >= MAX_FOLLOWING) {
    return { _tag: "follow-limit-reached", limit: MAX_FOLLOWING };
  }

  await ctx.db.insert("follows", {
    followerId: follower._id,
    followedId: followed._id,
  });

  return {
    _tag: "ok",
    state: "following",
    ...(await refreshCounts(ctx, follower._id, followed._id)),
  };
}

/**
 * Recount both sides of a changed relationship from the stored relations.
 *
 * Counting the indexed relations keeps the published counters equal to the
 * graph even when a relation was removed outside a toggle.
 */
async function refreshCounts(
  ctx: MutationCtx,
  followerId: Id<"members">,
  followedId: Id<"members">,
): Promise<{
  readonly followerCount: number;
  readonly viewerFollowingCount: number;
}> {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", followerId))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_followedId", (q) => q.eq("followedId", followedId))
      .collect(),
  ]);

  await ctx.db.patch("members", followerId, {
    followingCount: outgoing.length,
  });
  await ctx.db.patch("members", followedId, {
    followerCount: incoming.length,
  });

  return {
    followerCount: incoming.length,
    viewerFollowingCount: outgoing.length,
  };
}

/**
 * Read the Members who follow one Member, newest relationship first.
 *
 * @param ctx - The Convex query context.
 * @param memberIdInput - The route's untrusted Member id segment.
 * @returns The bounded follower list, or a missing-Member outcome.
 */
export async function listFollowers(
  ctx: QueryCtx,
  memberIdInput: string,
): Promise<ListRelationshipOutcome> {
  return await listRelationships(ctx, memberIdInput, "followers");
}

/**
 * Read the Members one Member follows, newest relationship first.
 *
 * @param ctx - The Convex query context.
 * @param memberIdInput - The route's untrusted Member id segment.
 * @returns The bounded following list, or a missing-Member outcome.
 */
export async function listFollowing(
  ctx: QueryCtx,
  memberIdInput: string,
): Promise<ListRelationshipOutcome> {
  return await listRelationships(ctx, memberIdInput, "following");
}

async function listRelationships(
  ctx: QueryCtx,
  memberIdInput: string,
  direction: "followers" | "following",
): Promise<ListRelationshipOutcome> {
  const memberId = ctx.db.normalizeId("members", memberIdInput);

  if (memberId === null) {
    return { _tag: "member-not-found" };
  }

  const member = await ctx.db.get("members", memberId);

  if (member === null) {
    return { _tag: "member-not-found" };
  }

  const relations =
    direction === "followers"
      ? await ctx.db
          .query("follows")
          .withIndex("by_followedId", (q) => q.eq("followedId", memberId))
          .order("desc")
          .take(RELATIONSHIP_LIMIT + 1)
      : await ctx.db
          .query("follows")
          .withIndex("by_followerId", (q) => q.eq("followerId", memberId))
          .order("desc")
          .take(RELATIONSHIP_LIMIT + 1);

  const summaries = await Promise.all(
    relations
      .slice(0, RELATIONSHIP_LIMIT)
      .map(
        async (relation) =>
          await toRelatedSummary(
            ctx,
            direction === "followers"
              ? relation.followerId
              : relation.followedId,
          ),
      ),
  );

  return {
    _tag: "ok",
    members: summaries,
    ending: relations.length > RELATIONSHIP_LIMIT ? "truncated" : "complete",
  };
}

async function toRelatedSummary(
  ctx: QueryCtx,
  memberId: Id<"members">,
): Promise<MemberSummary> {
  const member = await ctx.db.get("members", memberId);

  if (member === null) {
    return shouldNeverHappen(
      "Follow relation references a missing Member; Member deletion is out of scope",
    );
  }

  const registered = asRegistered(member);

  return registered === null
    ? shouldNeverHappen("Only registered Members can hold Follow relations")
    : toMemberSummary(registered);
}
