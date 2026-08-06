import { v, type Infer } from "convex/values";

/** The public projection of a Member shown on Profiles and Posts. */
export const memberProfileValidator = v.object({
  /** The Member's canonical identifier. */
  memberId: v.id("members"),
  /** The display name projected from Clerk. */
  displayName: v.string(),
  /** The avatar URL projected from Clerk, when one exists. */
  avatarUrl: v.optional(v.string()),
});

/** The public projection of a Member shown on Profiles and Posts. */
export type MemberProfile = Readonly<Infer<typeof memberProfileValidator>>;

/** The outcome of projecting the authenticated identity into a Member. */
export const ensureCurrentMemberOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok"), memberId: v.id("members") }),
  v.object({ _tag: v.literal("unauthenticated") }),
);

/** The outcome of projecting the authenticated identity into a Member. */
export type EnsureCurrentMemberOutcome = Readonly<
  Infer<typeof ensureCurrentMemberOutcomeValidator>
>;

/** The outcome of reading a Member's public Profile identity. */
export const getMemberProfileOutcomeValidator = v.union(
  v.object({ _tag: v.literal("ok"), profile: memberProfileValidator }),
  v.object({ _tag: v.literal("member-not-found") }),
);

/** The outcome of reading a Member's public Profile identity. */
export type GetMemberProfileOutcome = Readonly<
  Infer<typeof getMemberProfileOutcomeValidator>
>;
