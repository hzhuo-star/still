import type { Doc } from "../_generated/dataModel";
import type {
  MemberIdentity,
  MemberProfile,
  MemberSummary,
  RegisteredMemberProfile,
} from "../contract/member";
import { shouldNeverHappen } from "../lib/result";

/**
 * A Member record whose one-time Registration is complete, so its Still-owned
 * Handle is present rather than optional.
 */
export type RegisteredMemberRecord = Doc<"members"> & {
  readonly handle: string;
  readonly normalizedHandle: string;
};

/** The acting Member's own record, or why a Member-only operation cannot run. */
export type ActingMember =
  | { readonly _tag: "ok"; readonly member: RegisteredMemberRecord }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "registration-required" };

/**
 * Narrow a stored Member to its registered shape.
 *
 * @param member - The stored Member record.
 * @returns The registered record, or `null` when Registration is outstanding.
 * @throws When a record claims Registration without a Handle, which no write
 *   can produce and no projection can represent.
 */
export function asRegistered(
  member: Doc<"members">,
): RegisteredMemberRecord | null {
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

/**
 * Read a Member's public Follow counts.
 *
 * Pre-expansion records carry no counters, so absence reads as zero in exactly
 * one place rather than at every projection and write.
 *
 * @param member - The stored Member record, or `null` for a Member being created.
 * @returns Both public Follow counts.
 */
export function followCounts(member: Doc<"members"> | null): {
  readonly followerCount: number;
  readonly followingCount: number;
} {
  return {
    followerCount: member?.followerCount ?? 0,
    followingCount: member?.followingCount ?? 0,
  };
}

/**
 * Project a Member into the identity Still shows beside their Posts.
 *
 * @param member - The stored Member record.
 * @returns The Member's public identity projection.
 */
export function toMemberIdentity(member: Doc<"members">): MemberIdentity {
  return {
    memberId: member._id,
    displayName: member.displayName,
    ...(member.avatarUrl === undefined ? {} : { avatarUrl: member.avatarUrl }),
  };
}

/**
 * Project a registered Member into their public Profile.
 *
 * @param member - The registered Member record.
 * @returns The Member's public registered Profile.
 */
export function toRegisteredProfile(
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

/**
 * Project a Member into their public Profile in whichever state they hold.
 *
 * @param member - The stored Member record.
 * @returns The pending or registered public Profile.
 */
export function toMemberProfile(member: Doc<"members">): MemberProfile {
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
 * Project a registered Member into a relationship-list summary.
 *
 * @param member - The registered Member record.
 * @returns The Member's identity beside their current Handle.
 */
export function toMemberSummary(member: RegisteredMemberRecord): MemberSummary {
  return { ...toMemberIdentity(member), handle: member.handle };
}
