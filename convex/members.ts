import type { UserIdentity } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { shouldNeverHappen } from "./result";

/** The public projection of a Member shown on Profiles and Posts. */
const memberProfileValidator = v.object({
  /** The Member's canonical identifier. */
  memberId: v.id("members"),
  /** The display name projected from Clerk. */
  displayName: v.string(),
  /** The avatar URL projected from Clerk, when one exists. */
  avatarUrl: v.optional(v.string()),
});

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

/**
 * Look up the acting Member for a read-only operation.
 *
 * @param ctx - The Convex query context.
 * @returns The viewer's Member document, or `null` when the caller is
 *   signed out or has not entered Still since signing up.
 */
export async function currentMember(
  ctx: QueryCtx,
): Promise<Doc<"members"> | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return null;
  }

  return await ctx.db
    .query("members")
    .withIndex("by_externalId", (q) =>
      q.eq("externalId", identity.tokenIdentifier),
    )
    .unique();
}

/**
 * Idempotently project the authenticated Clerk identity into a Member,
 * creating the row on first entry and refreshing the display name and
 * avatar on return visits.
 *
 * @param ctx - The Convex mutation context.
 * @returns The acting Member document, or `null` when the caller is signed out.
 */
export async function ensureMember(
  ctx: MutationCtx,
): Promise<Doc<"members"> | null> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return null;
  }

  const projection = projectIdentity(identity);
  const existing = await ctx.db
    .query("members")
    .withIndex("by_externalId", (q) =>
      q.eq("externalId", identity.tokenIdentifier),
    )
    .unique();

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

  const member = await ctx.db.get("members", memberId);
  return member ?? shouldNeverHappen("Member row missing after upsert");
}

/**
 * Project the authenticated Clerk identity into a Member when the Member
 * enters Still. Safe to call repeatedly.
 */
export const ensureCurrent = mutation({
  args: {},
  returns: v.union(
    v.object({ _tag: v.literal("ok"), memberId: v.id("members") }),
    v.object({ _tag: v.literal("unauthenticated") }),
  ),
  handler: async (ctx) => {
    const member = await ensureMember(ctx);

    if (member === null) {
      return { _tag: "unauthenticated" as const };
    }

    return { _tag: "ok" as const, memberId: member._id };
  },
});

/** Read a Member's public Profile identity without authentication. */
export const getProfile = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: v.union(
    v.object({ _tag: v.literal("ok"), profile: memberProfileValidator }),
    v.object({ _tag: v.literal("member-not-found") }),
  ),
  handler: async (ctx, args) => {
    const memberId = ctx.db.normalizeId("members", args.memberId);

    if (memberId === null) {
      return { _tag: "member-not-found" as const };
    }

    const member = await ctx.db.get("members", memberId);

    if (member === null) {
      return { _tag: "member-not-found" as const };
    }

    return {
      _tag: "ok" as const,
      profile: {
        memberId: member._id,
        displayName: member.displayName,
        ...(member.avatarUrl === undefined
          ? {}
          : { avatarUrl: member.avatarUrl }),
      },
    };
  },
});
