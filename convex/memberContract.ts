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
export type EnsureCurrentMemberOutcome =
  | { readonly _tag: "ok"; readonly memberId: MemberProfile["memberId"] }
  | { readonly _tag: "unauthenticated" };

/** The outcome of reading a Member's public Profile identity. */
export type GetMemberProfileOutcome =
  | { readonly _tag: "ok"; readonly profile: MemberProfile }
  | { readonly _tag: "member-not-found" };
