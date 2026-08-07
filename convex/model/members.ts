import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  EnsureCurrentMemberOutcome,
  GetCurrentMemberOutcome,
  GetMemberProfileOutcome,
  MemberIdentity,
  MemberProfile as PublicMemberProfile,
  MemberRegistrationDefaults,
  RegisterCurrentMemberOutcome,
  RegisteredMemberProfile,
} from "../contract/member";
import * as MemberProfile from "../lib/memberProfile";
import { shouldNeverHappen } from "../lib/result";

/**
 * A Member record whose one-time Registration is complete, so its Still-owned
 * Handle is present rather than optional.
 */
type RegisteredMemberRecord = Doc<"members"> & {
  readonly handle: string;
  readonly normalizedHandle: string;
};

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

/**
 * Narrow a stored Member to its registered shape.
 *
 * A record that claims Registration without a Handle cannot be projected or
 * act, so it is treated as a defect rather than silently downgraded.
 */
function asRegistered(member: Doc<"members">): RegisteredMemberRecord | null {
  if (member.registrationState !== "registered") {
    return null;
  }

  if (member.handle === undefined || member.normalizedHandle === undefined) {
    return shouldNeverHappen("Registered Member is missing its Handle");
  }

  return {
    ...member,
    handle: member.handle,
    normalizedHandle: member.normalizedHandle,
  };
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

function toMemberIdentity(member: Doc<"members">): MemberIdentity {
  return {
    memberId: member._id,
    displayName: member.displayName,
    ...(member.avatarUrl === undefined ? {} : { avatarUrl: member.avatarUrl }),
  };
}

/**
 * Read a Member's public Follow counts.
 *
 * Pre-expansion records carry no counters, so absence reads as zero in exactly
 * one place rather than at every projection and write.
 */
function followCounts(member: Doc<"members"> | null): {
  readonly followerCount: number;
  readonly followingCount: number;
} {
  return {
    followerCount: member?.followerCount ?? 0,
    followingCount: member?.followingCount ?? 0,
  };
}

function toRegisteredProfile(
  member: RegisteredMemberRecord,
): RegisteredMemberProfile {
  return {
    registrationState: "registered",
    ...toMemberIdentity(member),
    handle: member.handle,
    ...(member.biography === undefined ? {} : { biography: member.biography }),
    ...followCounts(member),
  };
}

function toMemberProfile(member: Doc<"members">): PublicMemberProfile {
  const registered = asRegistered(member);

  return registered === null
    ? {
        registrationState: "pending",
        ...toMemberIdentity(member),
        ...followCounts(member),
      }
    : toRegisteredProfile(registered);
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
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    return { _tag: "unauthenticated" };
  }

  const member = await findByExternalId(ctx, identity.tokenIdentifier);

  if (member === null) {
    return { _tag: "registration-required" };
  }

  const registered = asRegistered(member);

  return registered === null
    ? { _tag: "registration-required" }
    : { _tag: "ok", memberId: registered._id };
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
    handle: draft.value.handle,
    normalizedHandle: draft.value.normalizedHandle,
    displayName: draft.value.displayName,
    ...(draft.value.biography._tag === "absent"
      ? {}
      : { biography: draft.value.biography.text }),
    ...followCounts(existing),
    searchText: MemberProfile.searchProjection([
      draft.value.handle,
      draft.value.displayName,
    ]),
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

async function readRegistered(
  ctx: MutationCtx,
  memberId: Id<"members">,
): Promise<RegisterCurrentMemberOutcome> {
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
 * Read a Member's public Profile in whichever registration state it holds.
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
