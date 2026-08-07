import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  ensureCurrentMemberOutcomeValidator,
  followIntentValidator,
  getCurrentMemberOutcomeValidator,
  getMemberProfileOutcomeValidator,
  registerCurrentMemberArgsValidator,
  registerCurrentMemberOutcomeValidator,
  listRelationshipOutcomeValidator,
  setFollowOutcomeValidator,
  updateCurrentProfileArgsValidator,
  updateCurrentProfileOutcomeValidator,
} from "./contract/member";
import * as Follows from "./model/follows";
import * as Members from "./model/members";

/**
 * Project the authenticated Clerk identity into a pending Member and refresh
 * whatever Clerk still owns. Safe to repeat; never completes Registration.
 */
export const ensureCurrent = mutation({
  args: {},
  returns: ensureCurrentMemberOutcomeValidator,
  handler: async (ctx) => await Members.ensureCurrent(ctx),
});

/** Read the viewer's own registered Profile or their onboarding requirement. */
export const getCurrent = query({
  args: {},
  returns: getCurrentMemberOutcomeValidator,
  handler: async (ctx) => await Members.getCurrent(ctx),
});

/** Complete Member Registration with the submitted Still-owned Profile. */
export const registerCurrent = mutation({
  args: registerCurrentMemberArgsValidator.fields,
  returns: registerCurrentMemberOutcomeValidator,
  handler: async (ctx, args) => await Members.registerCurrent(ctx, args),
});

/** Update the Still-owned portion of the acting Member's own Profile. */
export const updateCurrent = mutation({
  args: updateCurrentProfileArgsValidator.fields,
  returns: updateCurrentProfileOutcomeValidator,
  handler: async (ctx, args) => await Members.updateCurrent(ctx, args),
});

/** Read a Member's public Profile without authentication. */
export const getProfile = query({
  args: {
    /** The Profile route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: getMemberProfileOutcomeValidator,
  handler: async (ctx, args) => await Members.getProfile(ctx, args.memberId),
});

/** Apply the acting Member's Follow intent toward another registered Member. */
export const setFollow = mutation({
  args: {
    /** The Member the acting Member wants to follow or unfollow. */
    memberId: v.id("members"),
    /** The relationship the acting Member wants to hold. */
    intent: followIntentValidator,
  },
  returns: setFollowOutcomeValidator,
  handler: async (ctx, args) =>
    await Members.setFollow(ctx, args.memberId, args.intent),
});

/** Read the Members who follow one Member, newest relationship first. */
export const listFollowers = query({
  args: {
    /** The relationship route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: listRelationshipOutcomeValidator,
  handler: async (ctx, args) => await Follows.listFollowers(ctx, args.memberId),
});

/** Read the Members one Member follows, newest relationship first. */
export const listFollowing = query({
  args: {
    /** The relationship route's untrusted Member id segment. */
    memberId: v.string(),
  },
  returns: listRelationshipOutcomeValidator,
  handler: async (ctx, args) => await Follows.listFollowing(ctx, args.memberId),
});
