import { v, type Infer } from "convex/values";

import { listEndingValidator } from "./list";

/** The most Members one Member may follow. */
export const MAX_FOLLOWING = 50;

/** The most relationships one public relationship list renders. */
export const RELATIONSHIP_LIMIT = 50;

/** The projected identity Still shows beside a Member's Posts. */
export const memberIdentityValidator = v.object({
  /** The Member's canonical identifier. */
  memberId: v.id("members"),
  /** The Member's current public display name. */
  displayName: v.string(),
  /** The identity image projected from Clerk, when one exists. */
  avatarUrl: v.optional(v.string()),
});

/** The projected identity Still shows beside a Member's Posts. */
export type MemberIdentity = Readonly<Infer<typeof memberIdentityValidator>>;

const publicProfileFields = memberIdentityValidator.extend({
  /** The Member's public follower count. */
  followerCount: v.number(),
  /** The number of Members this Member follows. */
  followingCount: v.number(),
}).fields;

/**
 * A publicly readable Member who has not completed Member Registration.
 *
 * Legacy identities created before onboarding existed stay readable in this
 * state until their one-time Registration succeeds.
 */
export const pendingMemberProfileValidator = v.object({
  registrationState: v.literal("pending"),
  ...publicProfileFields,
});

/** A publicly readable Member who has not completed Member Registration. */
export type PendingMemberProfile = Readonly<
  Infer<typeof pendingMemberProfileValidator>
>;

/** A registered Member's public Profile, including Still-owned fields. */
export const registeredMemberProfileValidator = v.object({
  registrationState: v.literal("registered"),
  ...publicProfileFields,
  /** The Member's unique public Handle. */
  handle: v.string(),
  /** The Member's plain-text biography, when they wrote one. */
  biography: v.optional(v.string()),
});

/** A registered Member's public Profile, including Still-owned fields. */
export type RegisteredMemberProfile = Readonly<
  Infer<typeof registeredMemberProfileValidator>
>;

/** The public Profile of a Member in either registration state. */
export const memberProfileValidator = v.union(
  pendingMemberProfileValidator,
  registeredMemberProfileValidator,
);

/** The public Profile of a Member in either registration state. */
export type MemberProfile = Readonly<Infer<typeof memberProfileValidator>>;

/** The registration lifecycle of the Member behind an authenticated identity. */
export const memberRegistrationStateValidator = v.union(
  v.literal("pending"),
  v.literal("registered"),
);

/** The outcome of projecting the authenticated identity into a Member. */
export const ensureCurrentMemberOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    memberId: v.id("members"),
    registrationState: memberRegistrationStateValidator,
    /**
     * Whether this call first projected the identity into a Member. A `created`
     * projection is how Still recognizes an identity that has just arrived and
     * still owes onboarding.
     */
    projection: v.union(v.literal("created"), v.literal("refreshed")),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
);

/** The outcome of projecting the authenticated identity into a Member. */
export type EnsureCurrentMemberOutcome = Readonly<
  Infer<typeof ensureCurrentMemberOutcomeValidator>
>;

/** Clerk-derived values that may seed an empty onboarding form. */
export const memberRegistrationDefaultsValidator =
  memberIdentityValidator.omit("memberId");

/** Clerk-derived values that may seed an empty onboarding form. */
export type MemberRegistrationDefaults = Readonly<
  Infer<typeof memberRegistrationDefaultsValidator>
>;

/** The outcome of reading the viewer's own Member state. */
export const getCurrentMemberOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    profile: registeredMemberProfileValidator,
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({
    _tag: v.literal("registration-required"),
    defaults: memberRegistrationDefaultsValidator,
  }),
);

/** The outcome of reading the viewer's own Member state. */
export type GetCurrentMemberOutcome = Readonly<
  Infer<typeof getCurrentMemberOutcomeValidator>
>;

/** The Still-owned Profile values submitted to Member Registration. */
export const registerCurrentMemberArgsValidator = v.object({
  /** The requested public Handle. */
  handle: v.string(),
  /** The requested display name. */
  displayName: v.string(),
  /** The optional biography; blank text stores no biography. */
  biography: v.string(),
});

/** The Still-owned Profile values submitted to Member Registration. */
export type RegisterCurrentMemberArgs = Readonly<
  Infer<typeof registerCurrentMemberArgsValidator>
>;

/** A rejected Profile submission, naming the field the Member must fix. */
export const invalidMemberProfileOutcomeValidator = v.object({
  _tag: v.literal("invalid-profile"),
  /** The submitted field that was rejected. */
  field: v.union(
    v.literal("handle"),
    v.literal("display-name"),
    v.literal("biography"),
  ),
  /** Why that field was rejected. */
  reason: v.union(
    v.literal("empty"),
    v.literal("too-short"),
    v.literal("too-long"),
    v.literal("invalid-format"),
  ),
});

/** A rejected Profile submission, naming the field the Member must fix. */
export type InvalidMemberProfileOutcome = Readonly<
  Infer<typeof invalidMemberProfileOutcomeValidator>
>;

/** The outcome of completing Member Registration for the current identity. */
export const registerCurrentMemberOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    profile: registeredMemberProfileValidator,
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  v.object({
    _tag: v.literal("already-registered"),
    memberId: v.id("members"),
  }),
  invalidMemberProfileOutcomeValidator,
  v.object({
    _tag: v.literal("handle-unavailable"),
    /** The Handle another Member already owns. */
    handle: v.string(),
  }),
);

/** The outcome of completing Member Registration for the current identity. */
export type RegisterCurrentMemberOutcome = Readonly<
  Infer<typeof registerCurrentMemberOutcomeValidator>
>;

/**
 * The refusal every Member-only mutation returns for an authenticated identity
 * that has not completed Member Registration.
 */
export const registrationRequiredOutcomeValidator = v.object({
  _tag: v.literal("registration-required"),
});

/**
 * The Still-owned Profile values submitted to a Profile update.
 *
 * Registration and editing accept the same submission, because they apply the
 * same parsers to the same three Still-owned fields.
 */
export const updateCurrentProfileArgsValidator =
  registerCurrentMemberArgsValidator;

/** The Still-owned Profile values submitted to a Profile update. */
export type UpdateCurrentProfileArgs = Readonly<
  Infer<typeof updateCurrentProfileArgsValidator>
>;

/**
 * The outcome of updating the viewer's own Still-owned Profile.
 *
 * There is no wrong-Member outcome: the mutation resolves its subject from the
 * authenticated identity and accepts no Member id, so one Member cannot name
 * another's Profile.
 */
export const updateCurrentProfileOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    profile: registeredMemberProfileValidator,
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  invalidMemberProfileOutcomeValidator,
  v.object({
    _tag: v.literal("handle-unavailable"),
    /** The Handle another Member already owns. */
    handle: v.string(),
  }),
);

/** The outcome of updating the viewer's own Still-owned Profile. */
export type UpdateCurrentProfileOutcome = Readonly<
  Infer<typeof updateCurrentProfileOutcomeValidator>
>;

/**
 * The viewer's Follow relationship to the Profile they are reading.
 *
 * `unavailable` covers every viewer who cannot hold a relationship yet — signed
 * out, awaiting onboarding, or reading a Member who has not registered — so the
 * Follow control asks for the missing step instead of guessing.
 */
export const viewerFollowValidator = v.union(
  v.literal("self"),
  v.literal("following"),
  v.literal("not-following"),
  v.literal("unavailable"),
);

/** The viewer's Follow relationship to the Profile they are reading. */
export type ViewerFollow = Infer<typeof viewerFollowValidator>;

/** The outcome of reading a Member's public Profile. */
export const getMemberProfileOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    profile: memberProfileValidator,
    /** The reading viewer's own relationship to this Member. */
    viewerFollow: viewerFollowValidator,
  }),
  v.object({ _tag: v.literal("member-not-found") }),
);

/** One registered Member as a public relationship list renders them. */
export const memberSummaryValidator = memberIdentityValidator.extend({
  /** The Member's current public Handle. */
  handle: v.string(),
});

/** One registered Member as a public relationship list renders them. */
export type MemberSummary = Readonly<Infer<typeof memberSummaryValidator>>;

/**
 * The relationship a Follow request asks to hold.
 *
 * Naming the desired relationship instead of toggling whatever exists keeps a
 * stale request from inverting the actor's intent: asking again for a state
 * that already holds confirms it rather than reversing it.
 */
export const followIntentValidator = v.union(
  v.literal("follow"),
  v.literal("unfollow"),
);

/** The relationship a Follow request asks to hold. */
export type FollowIntent = Infer<typeof followIntentValidator>;

/** The outcome of applying the acting Member's Follow intent. */
export const setFollowOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    /** The acting Member's relationship after the request. */
    state: v.union(v.literal("following"), v.literal("not-following")),
    /** The followed Member's follower count after the request. */
    followerCount: v.number(),
    /** The acting Member's following count after the request. */
    viewerFollowingCount: v.number(),
  }),
  v.object({ _tag: v.literal("unauthenticated") }),
  registrationRequiredOutcomeValidator,
  v.object({ _tag: v.literal("member-not-found") }),
  v.object({ _tag: v.literal("member-not-registered") }),
  v.object({ _tag: v.literal("self-follow") }),
  v.object({
    _tag: v.literal("follow-limit-reached"),
    /** The most Members one Member may follow. */
    limit: v.number(),
  }),
);

/** The outcome of applying the acting Member's Follow intent. */
export type SetFollowOutcome = Readonly<
  Infer<typeof setFollowOutcomeValidator>
>;

/** The outcome of reading one Member's bounded relationship list. */
export const listRelationshipOutcomeValidator = v.union(
  v.object({
    _tag: v.literal("ok"),
    /** The newest relationships, bounded to {@link RELATIONSHIP_LIMIT}. */
    members: v.array(memberSummaryValidator),
    /** Whether older relationships exist beyond the bounded list. */
    ending: listEndingValidator,
  }),
  v.object({ _tag: v.literal("member-not-found") }),
);

/** The outcome of reading one Member's bounded relationship list. */
export type ListRelationshipOutcome = Readonly<
  Infer<typeof listRelationshipOutcomeValidator>
>;

/** The outcome of reading a Member's public Profile. */
export type GetMemberProfileOutcome = Readonly<
  Infer<typeof getMemberProfileOutcomeValidator>
>;
