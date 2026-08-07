import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  MAX_FOLLOWING,
  RELATIONSHIP_LIMIT,
  type FollowIntent,
  type ListRelationshipOutcome,
  type MemberSummary,
  type SetFollowOutcome,
  type ViewerFollow,
} from "../contract/member";
import { shouldNeverHappen } from "../lib/result";
import {
  asRegistered,
  followCounts,
  toMemberSummary,
  type ActingMember,
  type RegisteredMemberRecord,
} from "./memberProjection";

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
 * Apply the acting Member's Follow intent toward another registered Member.
 *
 * The intent names the relationship the actor wants to hold, so a stale
 * request can never invert their action: asking to unfollow a relation that is
 * already gone, or to follow one that already exists, confirms the current
 * state without writing or moving a counter. The relation, both counters, and
 * the outgoing limit are read and written in one transaction, so a retried or
 * concurrent request can never leave two relations, a counter that disagrees
 * with the graph, or a 51st outgoing Follow.
 *
 * @param ctx - The Convex mutation context.
 * @param acting - The acting Member, or why the operation cannot run.
 * @param followedMemberId - The Member being followed or unfollowed.
 * @param intent - The relationship the acting Member wants to hold.
 * @returns The confirmed relationship and both counts, or a precise failure.
 */
export async function setFollow(
  ctx: MutationCtx,
  acting: ActingMember,
  followedMemberId: Id<"members">,
  intent: FollowIntent,
): Promise<SetFollowOutcome> {
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

  if (intent === "unfollow") {
    if (relation === null) {
      return {
        _tag: "ok",
        state: "not-following",
        ...currentCounts(follower, followed),
      };
    }

    await ctx.db.delete("follows", relation._id);

    return {
      _tag: "ok",
      state: "not-following",
      ...(await applyCountDelta(ctx, follower, followed, -1)),
    };
  }

  if (relation !== null) {
    return {
      _tag: "ok",
      state: "following",
      ...currentCounts(follower, followed),
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
    ...(await applyCountDelta(ctx, follower, followed, 1)),
  };
}

/** Both published counters as the stored Members already carry them. */
function currentCounts(
  follower: RegisteredMemberRecord,
  followed: Doc<"members">,
): {
  readonly followerCount: number;
  readonly viewerFollowingCount: number;
} {
  return {
    followerCount: followCounts(followed).followerCount,
    viewerFollowingCount: followCounts(follower).followingCount,
  };
}

/**
 * Move both counters by the one relation this transaction inserted or deleted.
 *
 * The delta lands in the same transaction as the relation write it mirrors,
 * and every relation write goes through {@link setFollow}, so the serialized
 * counters always equal the stored graph without recounting the uncapped
 * follower side.
 */
async function applyCountDelta(
  ctx: MutationCtx,
  follower: RegisteredMemberRecord,
  followed: Doc<"members">,
  delta: 1 | -1,
): Promise<{
  readonly followerCount: number;
  readonly viewerFollowingCount: number;
}> {
  const followerCount = followCounts(followed).followerCount + delta;
  const viewerFollowingCount = followCounts(follower).followingCount + delta;

  await ctx.db.patch("members", followed._id, { followerCount });
  await ctx.db.patch("members", follower._id, {
    followingCount: viewerFollowingCount,
  });

  return { followerCount, viewerFollowingCount };
}

/**
 * Read the Members one Member currently follows, for bounded fan-in reads.
 *
 * The outgoing side is capped at {@link MAX_FOLLOWING} by {@link setFollow},
 * so the whole graph edge list a Following Feed needs fits one bounded read.
 *
 * @param ctx - The Convex query context.
 * @param followerId - The Member whose outgoing relationships are read.
 * @returns The followed Member ids, at most {@link MAX_FOLLOWING}.
 */
export async function followedMemberIds(
  ctx: QueryCtx,
  followerId: Id<"members">,
): Promise<ReadonlyArray<Id<"members">>> {
  const relations = await ctx.db
    .query("follows")
    .withIndex("by_followerId", (q) => q.eq("followerId", followerId))
    .take(MAX_FOLLOWING);

  return relations.map((relation) => relation.followedId);
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
