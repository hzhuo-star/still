/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { MAX_FOLLOWING, RELATIONSHIP_LIMIT } from "../contract/member";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  return convexTest(schema, modules);
}

type TestIdentity = {
  readonly subject: string;
  readonly name?: string;
};

const aliceIdentity = {
  subject: "user_alice",
  name: "Alice Reader",
  pictureUrl: "https://img.clerk.com/alice.png",
} as const;

const benIdentity = { subject: "user_ben", name: "Ben Quiet" } as const;
const claraIdentity = { subject: "user_clara", name: "Clara Note" } as const;

async function register(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
): Promise<Id<"members">> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.members.registerCurrent, {
      handle: identity.subject,
      displayName: identity.name ?? "Member",
      biography: "",
    });

  if (outcome._tag === "ok") {
    return outcome.profile.memberId;
  }
  if (outcome._tag === "already-registered") {
    return outcome.memberId;
  }

  throw new Error(`Expected a registered Member, got ${outcome._tag}`);
}

function numberedIdentity(index: number): TestIdentity {
  return { subject: `member_${index}`, name: `Member ${index}` };
}

async function follow(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
  memberId: Id<"members">,
): Promise<void> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.members.setFollow, { memberId, intent: "follow" });

  if (outcome._tag !== "ok" || outcome.state !== "following") {
    throw new Error(`Expected a Follow, got ${outcome._tag}`);
  }
}

async function storedCounts(
  backend: TestConvex<typeof schema>,
  memberId: Id<"members">,
): Promise<{ readonly follower: number; readonly following: number }> {
  return await backend.run(async (ctx) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followedId", (q) => q.eq("followedId", memberId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_followerId", (q) => q.eq("followerId", memberId))
      .collect();

    return { follower: followers.length, following: following.length };
  });
}

describe("Members.setFollow", () => {
  test("refuses signed-out and unregistered actors without a relation", async () => {
    const backend = newBackend();
    const benId = await register(backend, benIdentity);

    await expect(
      backend.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "follow",
      }),
    ).resolves.toEqual({ _tag: "unauthenticated" });

    const awaiting = backend.withIdentity(claraIdentity);
    await awaiting.mutation(api.members.ensureCurrent, {});
    await expect(
      awaiting.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "follow",
      }),
    ).resolves.toEqual({ _tag: "registration-required" });

    expect(await storedCounts(backend, benId)).toEqual({
      follower: 0,
      following: 0,
    });
  });

  test("follows and unfollows immediately with agreeing counters", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);

    const followed = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.setFollow, { memberId: benId, intent: "follow" });

    expect(followed).toEqual({
      _tag: "ok",
      state: "following",
      followerCount: 1,
      viewerFollowingCount: 1,
    });
    expect(await storedCounts(backend, benId)).toEqual({
      follower: 1,
      following: 0,
    });
    await expect(
      backend.query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      profile: { followerCount: 1, followingCount: 0 },
    });
    await expect(
      backend.query(api.members.getProfile, { memberId: aliceId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      profile: { followerCount: 0, followingCount: 1 },
    });

    const unfollowed = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.setFollow, { memberId: benId, intent: "unfollow" });

    expect(unfollowed).toEqual({
      _tag: "ok",
      state: "not-following",
      followerCount: 0,
      viewerFollowingCount: 0,
    });
    expect(await storedCounts(backend, benId)).toEqual({
      follower: 0,
      following: 0,
    });
  });

  test("rejects following oneself without touching counters", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);

    await expect(
      backend.withIdentity(aliceIdentity).mutation(api.members.setFollow, {
        memberId: aliceId,
        intent: "follow",
      }),
    ).resolves.toEqual({ _tag: "self-follow" });
    expect(await storedCounts(backend, aliceId)).toEqual({
      follower: 0,
      following: 0,
    });
    await expect(
      backend.query(api.members.getProfile, { memberId: aliceId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      profile: { followerCount: 0, followingCount: 0 },
    });
  });

  test("reports missing and unregistered Members precisely", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const pendingId = await backend.run(async (ctx) =>
      ctx.db.insert("members", {
        externalId: "https://clerk.example|pending",
        displayName: "Pending Member",
      }),
    );
    const asAlice = backend.withIdentity(aliceIdentity);

    await expect(
      asAlice.mutation(api.members.setFollow, {
        memberId: pendingId,
        intent: "follow",
      }),
    ).resolves.toEqual({ _tag: "member-not-registered" });
    expect(await storedCounts(backend, pendingId)).toEqual({
      follower: 0,
      following: 0,
    });
  });

  test("keeps concurrent Follow attempts to one relation", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    const asAlice = backend.withIdentity(aliceIdentity);

    const outcomes = await Promise.all([
      asAlice.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "follow",
      }),
      asAlice.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "follow",
      }),
    ]);

    // Two identical intents settle as one relation and one honest counter.
    expect(outcomes).toEqual([
      expect.objectContaining({ _tag: "ok", state: "following" }),
      expect.objectContaining({ _tag: "ok", state: "following" }),
    ]);
    expect(await storedCounts(backend, benId)).toEqual({
      follower: 1,
      following: 0,
    });
    await expect(
      backend.query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      profile: { followerCount: 1 },
    });
  });

  test("confirms a stale unfollow without re-following or double-decrementing", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await follow(backend, aliceIdentity, benId);
    const asAlice = backend.withIdentity(aliceIdentity);

    // A second session already removed the relation through the same contract.
    await expect(
      asAlice.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "unfollow",
      }),
    ).resolves.toEqual({
      _tag: "ok",
      state: "not-following",
      followerCount: 0,
      viewerFollowingCount: 0,
    });

    // The stale session's unfollow confirms the state it wanted; it neither
    // re-follows nor pushes a counter below the true graph.
    await expect(
      asAlice.mutation(api.members.setFollow, {
        memberId: benId,
        intent: "unfollow",
      }),
    ).resolves.toEqual({
      _tag: "ok",
      state: "not-following",
      followerCount: 0,
      viewerFollowingCount: 0,
    });
    expect(await storedCounts(backend, benId)).toEqual({
      follower: 0,
      following: 0,
    });
    await expect(
      backend.query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({ _tag: "ok", profile: { followerCount: 0 } });
  });

  test("rejects the Follow beyond the outgoing limit", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const targets: Array<Id<"members">> = [];

    for (let index = 0; index < MAX_FOLLOWING + 1; index += 1) {
      targets.push(await register(backend, numberedIdentity(index)));
    }

    for (const target of targets.slice(0, MAX_FOLLOWING)) {
      await follow(backend, aliceIdentity, target);
    }

    const beyondLimit = targets[MAX_FOLLOWING];
    if (beyondLimit === undefined) {
      throw new Error("Expected one target beyond the limit");
    }

    await expect(
      backend.withIdentity(aliceIdentity).mutation(api.members.setFollow, {
        memberId: beyondLimit,
        intent: "follow",
      }),
    ).resolves.toEqual({ _tag: "follow-limit-reached", limit: MAX_FOLLOWING });
    expect(await storedCounts(backend, beyondLimit)).toEqual({
      follower: 0,
      following: 0,
    });
  });

  test("leaves inbound relationships uncapped", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);

    for (let index = 0; index < MAX_FOLLOWING + 1; index += 1) {
      const identity = numberedIdentity(index);
      await register(backend, identity);
      await follow(backend, identity, aliceId);
    }

    await expect(
      backend.query(api.members.getProfile, { memberId: aliceId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      profile: { followerCount: MAX_FOLLOWING + 1, followingCount: 0 },
    });
  });
});

describe("Members.getProfile viewer Follow state", () => {
  test("reports self, following, not-following, and unavailable", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);

    await expect(
      backend.query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({ _tag: "ok", viewerFollow: "unavailable" });
    await expect(
      backend
        .withIdentity(aliceIdentity)
        .query(api.members.getProfile, { memberId: aliceId }),
    ).resolves.toMatchObject({ _tag: "ok", viewerFollow: "self" });
    await expect(
      backend
        .withIdentity(aliceIdentity)
        .query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({ _tag: "ok", viewerFollow: "not-following" });

    await follow(backend, aliceIdentity, benId);

    await expect(
      backend
        .withIdentity(aliceIdentity)
        .query(api.members.getProfile, { memberId: benId }),
    ).resolves.toMatchObject({ _tag: "ok", viewerFollow: "following" });
  });
});

describe("Members relationship lists", () => {
  test("report a missing Member for an unknown id", async () => {
    const backend = newBackend();

    await expect(
      backend.query(api.members.listFollowers, { memberId: "not-a-member" }),
    ).resolves.toEqual({ _tag: "member-not-found" });
    await expect(
      backend.query(api.members.listFollowing, { memberId: "not-a-member" }),
    ).resolves.toEqual({ _tag: "member-not-found" });
  });

  test("list newest relationships first with current Member summaries", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    const claraId = await register(backend, claraIdentity);

    await follow(backend, benIdentity, aliceId);
    await follow(backend, claraIdentity, aliceId);
    await follow(backend, aliceIdentity, claraId);

    await backend
      .withIdentity(claraIdentity)
      .mutation(api.members.updateCurrent, {
        handle: "clara_notes",
        displayName: "Clara Notes",
        biography: "",
      });

    await expect(
      backend.query(api.members.listFollowers, { memberId: aliceId }),
    ).resolves.toEqual({
      _tag: "ok",
      ending: "complete",
      members: [
        {
          memberId: claraId,
          handle: "clara_notes",
          displayName: "Clara Notes",
        },
        { memberId: benId, handle: "user_ben", displayName: "Ben Quiet" },
      ],
    });
    await expect(
      backend.query(api.members.listFollowing, { memberId: aliceId }),
    ).resolves.toEqual({
      _tag: "ok",
      ending: "complete",
      members: [
        {
          memberId: claraId,
          handle: "clara_notes",
          displayName: "Clara Notes",
        },
      ],
    });
  });

  test("bound a follower list and report honest truncation", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);

    for (let index = 0; index < RELATIONSHIP_LIMIT + 1; index += 1) {
      const identity = numberedIdentity(index);
      await register(backend, identity);
      await follow(backend, identity, aliceId);
    }

    const followers = await backend.query(api.members.listFollowers, {
      memberId: aliceId,
    });

    expect(followers).toMatchObject({ _tag: "ok", ending: "truncated" });
    if (followers._tag !== "ok") {
      return;
    }
    expect(followers.members).toHaveLength(RELATIONSHIP_LIMIT);
    expect(followers.members[0]?.handle).toBe(
      `member_${RELATIONSHIP_LIMIT}`.toLowerCase(),
    );
  });
});
