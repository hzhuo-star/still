import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  EnsureCurrentMemberOutcome,
  GetCurrentMemberOutcome,
  GetMemberProfileOutcome,
  MemberIdentity,
  MemberRegistrationDefaults,
  RegisterCurrentMemberOutcome,
  ToggleFollowOutcome,
  RegisteredMemberProfile,
  UpdateCurrentProfileOutcome,
} from "../contract/member";
import * as MemberProfile from "../lib/memberProfile";
import { shouldNeverHappen } from "../lib/result";
import * as Follows from "./follows";
import { viewerFollow } from "./follows";
import {
  asRegistered,
  followCounts,
  toMemberIdentity,
  toMemberProfile,
  toRegisteredProfile,
  type RegisteredMemberRecord,
} from "./memberProjection";

function findByExternalId(
  ctx: QueryCtx,
  externalId: string,
): Promise<Doc<"members"> | null> {
  return ctx.db
    .query("members")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
}

function findByNormalizedHandle(
  ctx: QueryCtx,
  normalizedHandle: MemberProfile.NormalizedHandle,
): Promise<Doc<"members"> | null> {
  return ctx.db
    .query("members")
    .withIndex("by_normalizedHandle", (q) =>
      q.eq("normalizedHandle", normalizedHandle),
    )
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

/**
 * Resolve the acting Member for a read-only operation.
 *
 * Both pending and registered Members resolve here so a legacy author keeps
 * their existing viewer projections while they await onboarding.
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

/** The acting Member of a Member-only operation, or why there is none. */
export type CurrentMemberRequirement =
  | { readonly _tag: "ok"; readonly memberId: Id<"members"> }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "registration-required" };

/**
 * Require a registered Member before a Member-only operation proceeds.
 *
 * Unlike {@link ensureCurrent} this never creates or completes a Member, so an
 * authenticated identity cannot become a participant by acting.
 *
 * @param ctx - The Convex query context.
 * @returns The acting Member id, or a precise refusal.
 */
export async function requireCurrent(
  ctx: QueryCtx,
): Promise<CurrentMemberRequirement> {
  const current = await currentRegisteredMember(ctx);

  return current._tag === "ok"
    ? { _tag: "ok", memberId: current.member._id }
    : current;
}

/** The acting Member's own record, or why a Member-only operation cannot run. */
type CurrentRegisteredMember =
  | { readonly _tag: "ok"; readonly member: RegisteredMemberRecord }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "registration-required" };

async function currentRegisteredMember(
  ctx: QueryCtx,
): Promise<CurrentRegisteredMember> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const member = await findByExternalId(ctx, identity.tokenIdentifier);
  const registered = member === null ? null : asRegistered(member);

  return registered === null
    ? { _tag: "registration-required" }
    : { _tag: "ok", member: registered };
}

/**
 * Idempotently project the authenticated identity into a pending Member and
 * refresh whatever Clerk still owns.
 *
 * A pending Member tracks the Clerk display name and identity image. After
 * Registration only the identity image refreshes, because Still owns the
 * Handle, display name, and biography from then on.
 *
 * @param ctx - The Convex mutation context.
 * @returns The projected Member id, its registration state, and whether this
 *   call first created it, or an unauthenticated outcome.
 */
export async function ensureCurrent(
  ctx: MutationCtx,
): Promise<EnsureCurrentMemberOutcome> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const identityFields = projectIdentity(identity);
  const existing = await findByExternalId(ctx, identity.tokenIdentifier);

  if (existing === null) {
    const memberId = await ctx.db.insert("members", {
      externalId: identity.tokenIdentifier,
      ...identityFields,
      registrationState: "pending",
      ...followCounts(null),
      searchText: MemberProfile.searchProjection([identityFields.displayName]),
    });

    return {
      _tag: "ok",
      memberId,
      registrationState: "pending",
      projection: "created",
    };
  }

  const registered = asRegistered(existing);

  if (registered !== null) {
    if (registered.avatarUrl !== identityFields.avatarUrl) {
      await ctx.db.patch("members", registered._id, {
        avatarUrl: identityFields.avatarUrl,
      });
    }

    return {
      _tag: "ok",
      memberId: registered._id,
      registrationState: "registered",
      projection: "refreshed",
    };
  }

  if (
    existing.displayName !== identityFields.displayName ||
    existing.avatarUrl !== identityFields.avatarUrl ||
    existing.registrationState === undefined
  ) {
    await ctx.db.patch("members", existing._id, {
      ...identityFields,
      registrationState: "pending",
      ...followCounts(existing),
      searchText: MemberProfile.searchProjection([identityFields.displayName]),
    });
  }

  return {
    _tag: "ok",
    memberId: existing._id,
    registrationState: "pending",
    projection: "refreshed",
  };
}

/**
 * Read the viewer's own Member state for onboarding and Member-only surfaces.
 *
 * @param ctx - The Convex query context.
 * @returns The registered Profile, the values that may seed onboarding, or an
 *   unauthenticated outcome.
 */
export async function getCurrent(
  ctx: QueryCtx,
): Promise<GetCurrentMemberOutcome> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const member = await findByExternalId(ctx, identity.tokenIdentifier);
  const registered = member === null ? null : asRegistered(member);

  if (registered === null) {
    const defaults: MemberRegistrationDefaults = projectIdentity(identity);
    return { _tag: "registration-required", defaults };
  }

  return { _tag: "ok", profile: toRegisteredProfile(registered) };
}

/**
 * The Still-owned Profile fields one parsed submission writes.
 *
 * An absent biography is omitted rather than stored as an empty value, so a
 * Profile carries a biography only when its Member wrote one.
 */
function stillOwnedProfileFields(draft: MemberProfile.MemberProfileDraft): {
  readonly handle: string;
  readonly normalizedHandle: string;
  readonly displayName: string;
  readonly biography?: string;
  readonly searchText: string;
} {
  return {
    handle: draft.handle,
    normalizedHandle: draft.normalizedHandle,
    displayName: draft.displayName,
    ...(draft.biography._tag === "absent"
      ? {}
      : { biography: draft.biography.text }),
    searchText: MemberProfile.searchProjection([
      draft.handle,
      draft.displayName,
    ]),
  };
}

/**
 * Complete Member Registration for the authenticated identity.
 *
 * Parsing happens before any write, so a rejected submission leaves no Member
 * behind. Handle ownership is claimed in the same transaction as the write, so
 * concurrent claims of one normalized Handle cannot both succeed, and a legacy
 * Member keeps its id, Posts, and engagement.
 *
 * @param ctx - The Convex mutation context.
 * @param input - The untrusted Still-owned Profile values submitted.
 * @returns The registered Profile, or a precise expected failure.
 */
export async function registerCurrent(
  ctx: MutationCtx,
  input: MemberProfile.MemberProfileInput,
): Promise<RegisterCurrentMemberOutcome> {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const draft = MemberProfile.parse(input);

  if (draft._tag === "err") {
    return {
      _tag: "invalid-profile",
      field: draft.error.field,
      reason: draft.error.reason,
    };
  }

  const existing = await findByExternalId(ctx, identity.tokenIdentifier);
  const alreadyRegistered = existing === null ? null : asRegistered(existing);

  if (alreadyRegistered !== null) {
    return { _tag: "already-registered", memberId: alreadyRegistered._id };
  }

  const owner = await findByNormalizedHandle(ctx, draft.value.normalizedHandle);

  if (owner !== null) {
    return { _tag: "handle-unavailable", handle: draft.value.handle };
  }

  const registration = {
    registrationState: "registered" as const,
    ...stillOwnedProfileFields(draft.value),
    ...followCounts(existing),
  };

  const identityFields = projectIdentity(identity);

  if (existing === null) {
    const memberId = await ctx.db.insert("members", {
      externalId: identity.tokenIdentifier,
      ...identityFields,
      ...registration,
    });

    return await readRegistered(ctx, memberId);
  }

  // Registration is also an identity refresh: Clerk keeps the identity image
  // while every Still-owned field comes from the submitted draft.
  await ctx.db.patch("members", existing._id, {
    ...registration,
    avatarUrl: identityFields.avatarUrl,
  });

  return await readRegistered(ctx, existing._id);
}

/**
 * Update the Still-owned portion of the acting Member's own Profile.
 *
 * The subject is the authenticated identity's own Member, so no caller can name
 * another Member's Profile. Handle ownership moves inside the same transaction
 * as the write: the row that holds the normalized Handle is the row being
 * updated, so the previous Handle is released the moment the new one is taken,
 * with no alias, redirect, or reservation left behind. Keeping the same
 * normalized Handle skips the ownership check entirely, so a Member editing
 * only their display name or biography cannot collide with themselves.
 *
 * @param ctx - The Convex mutation context.
 * @param input - The untrusted Still-owned Profile values submitted.
 * @returns The updated Profile, or a precise expected failure.
 */
export async function updateCurrent(
  ctx: MutationCtx,
  input: MemberProfile.MemberProfileInput,
): Promise<UpdateCurrentProfileOutcome> {
  const current = await currentRegisteredMember(ctx);

  if (current._tag !== "ok") {
    return current;
  }

  const draft = MemberProfile.parse(input);

  if (draft._tag === "err") {
    return {
      _tag: "invalid-profile",
      field: draft.error.field,
      reason: draft.error.reason,
    };
  }

  if (draft.value.normalizedHandle !== current.member.normalizedHandle) {
    const owner = await findByNormalizedHandle(
      ctx,
      draft.value.normalizedHandle,
    );

    if (owner !== null) {
      return { _tag: "handle-unavailable", handle: draft.value.handle };
    }
  }

  await ctx.db.patch("members", current.member._id, {
    ...stillOwnedProfileFields(draft.value),
    // A removed biography clears the stored field; patching an omitted field
    // would keep the previous text instead.
    ...(draft.value.biography._tag === "absent"
      ? { biography: undefined }
      : {}),
  });

  return await readRegistered(ctx, current.member._id);
}

/** Re-read a Member the current transaction has just written as registered. */
async function readRegistered(
  ctx: MutationCtx,
  memberId: Id<"members">,
): Promise<{
  readonly _tag: "ok";
  readonly profile: RegisteredMemberProfile;
}> {
  const member = await ctx.db.get("members", memberId);
  const registered = member === null ? null : asRegistered(member);

  return registered === null
    ? shouldNeverHappen("Member Registration did not persist its own Member")
    : { _tag: "ok", profile: toRegisteredProfile(registered) };
}

/**
 * Read one Member's projected identity for display beside their Posts.
 *
 * @param ctx - The Convex query context.
 * @param memberId - The Member whose identity is projected.
 * @returns The projected identity, or `null` when no such Member exists.
 */
export async function getIdentity(
  ctx: QueryCtx,
  memberId: Id<"members">,
): Promise<MemberIdentity | null> {
  const member = await ctx.db.get("members", memberId);

  return member === null ? null : toMemberIdentity(member);
}

/**
 * Read a Member's public Profile in whichever registration state it holds,
 * beside the reading viewer's own relationship to them.
 *
 * @param ctx - The Convex query context.
 * @param memberId - The Profile route's untrusted Member id segment.
 * @returns The public Profile and viewer relationship, or a missing-Member
 *   outcome.
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

  if (member === null) {
    return { _tag: "member-not-found" };
  }

  return {
    _tag: "ok",
    profile: toMemberProfile(member),
    viewerFollow: await viewerFollow(
      ctx,
      await currentRegisteredMember(ctx),
      member,
    ),
  };
}

/**
 * Follow or unfollow another registered Member as the acting Member.
 *
 * @param ctx - The Convex mutation context.
 * @param followedMemberId - The Member being followed or unfollowed.
 * @returns The new relationship and both counts, or a precise failure.
 */
export async function toggleFollow(
  ctx: MutationCtx,
  followedMemberId: Id<"members">,
): Promise<ToggleFollowOutcome> {
  return await Follows.toggle(
    ctx,
    await currentRegisteredMember(ctx),
    followedMemberId,
  );
}
