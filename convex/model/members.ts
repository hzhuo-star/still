import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  EnsureCurrentMemberOutcome,
  GetMemberProfileOutcome,
  MemberProfile,
} from "../memberContract";

function findByExternalId(
  ctx: QueryCtx,
  externalId: string,
): Promise<Doc<"members"> | null> {
  return ctx.db
    .query("members")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
}

/** The identity fields Still projects from a verified Clerk identity. */
type IdentityProjection = {
  readonly displayName: string;
  readonly avatarUrl?: string;
};

function projectIdentity(identity: UserIdentity): IdentityProjection {
  const displayName =
    identity.name ?? identity.nickname ?? identity.email ?? "Member";

  return identity.pictureUrl === undefined
    ? { displayName }
    : { displayName, avatarUrl: identity.pictureUrl };
}

function toMemberProfile(member: Doc<"members">): MemberProfile {
  return {
    memberId: member._id,
    displayName: member.displayName,
    ...(member.avatarUrl === undefined ? {} : { avatarUrl: member.avatarUrl }),
  };
}

/**
 * Resolve the acting Member for a read-only operation.
 *
 * @param ctx - The Convex query context.
 * @returns The viewer's Member id, or `null` when signed out or not projected.
 */
export async function currentMemberId(
  ctx: QueryCtx,
): Promise<Id<"members"> | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return null;
  }

  const member = await findByExternalId(ctx, identity.tokenIdentifier);
  return member?._id ?? null;
}

/**
 * Idempotently project the authenticated identity into a Member.
 *
 * @param ctx - The Convex mutation context.
 * @returns The acting Member id or an unauthenticated outcome.
 */
export async function ensureCurrent(
  ctx: MutationCtx,
): Promise<EnsureCurrentMemberOutcome> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const projection = projectIdentity(identity);
  const existing = await findByExternalId(ctx, identity.tokenIdentifier);

  const memberId =
    existing === null
      ? await ctx.db.insert("members", {
          externalId: identity.tokenIdentifier,
          ...projection,
        })
      : existing._id;

  if (
    existing !== null &&
    (existing.displayName !== projection.displayName ||
      existing.avatarUrl !== projection.avatarUrl)
  ) {
    await ctx.db.patch("members", memberId, {
      displayName: projection.displayName,
      avatarUrl: projection.avatarUrl,
    });
  }

  return { _tag: "ok", memberId };
}

/**
 * Read a Member's public Profile identity.
 *
 * @param ctx - The Convex query context.
 * @param memberId - The Profile route's untrusted Member id segment.
 * @returns The public Profile or a missing-Member outcome.
 */
export async function getProfile(
  ctx: QueryCtx,
  memberId: string,
): Promise<GetMemberProfileOutcome> {
  const normalizedMemberId = ctx.db.normalizeId("members", memberId);

  if (normalizedMemberId === null) {
    return { _tag: "member-not-found" };
  }

  const member = await ctx.db.get("members", normalizedMemberId);

  return member === null
    ? { _tag: "member-not-found" }
    : { _tag: "ok", profile: toMemberProfile(member) };
}
