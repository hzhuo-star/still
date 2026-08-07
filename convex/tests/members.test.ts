/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  return convexTest(schema, modules);
}

const aliceIdentity = {
  subject: "user_alice",
  name: "Alice Reader",
  pictureUrl: "https://img.clerk.com/alice.png",
} as const;

const benIdentity = {
  subject: "user_ben",
  name: "Ben Quiet",
} as const;

describe("Members registration", () => {
  test("keeps signed-out callers public and reports unauthenticated registration", async () => {
    const backend = newBackend();

    await expect(backend.query(api.members.getCurrent, {})).resolves.toEqual({
      _tag: "unauthenticated",
    });
    await expect(
      backend.mutation(api.members.registerCurrent, {
        handle: "alice",
        displayName: "Alice",
        biography: "",
      }),
    ).resolves.toEqual({ _tag: "unauthenticated" });
  });

  test("creates a pending Member and returns useful onboarding defaults", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    const ensured = await asAlice.mutation(api.members.ensureCurrent, {});
    const current = await asAlice.query(api.members.getCurrent, {});

    expect(ensured).toMatchObject({
      _tag: "ok",
      registrationState: "pending",
    });
    expect(current).toEqual({
      _tag: "registration-required",
      defaults: {
        displayName: "Alice Reader",
        avatarUrl: "https://img.clerk.com/alice.png",
      },
    });
  });

  test("registers once with parsed Still-owned Profile fields", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    const registered = await asAlice.mutation(api.members.registerCurrent, {
      handle: "alice_reader",
      displayName: "  Alice Reader  ",
      biography: "  Writes quiet notes.  ",
    });

    expect(registered._tag).toBe("ok");
    if (registered._tag !== "ok") {
      return;
    }

    expect(registered.profile).toEqual({
      registrationState: "registered",
      memberId: registered.profile.memberId,
      handle: "alice_reader",
      displayName: "Alice Reader",
      biography: "Writes quiet notes.",
      avatarUrl: "https://img.clerk.com/alice.png",
      followerCount: 0,
      followingCount: 0,
    });
    await expect(asAlice.query(api.members.getCurrent, {})).resolves.toEqual({
      _tag: "ok",
      profile: registered.profile,
    });
    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "different",
        displayName: "Different",
        biography: "",
      }),
    ).resolves.toMatchObject({
      _tag: "already-registered",
      memberId: registered.profile.memberId,
    });
  });

  test("returns field-specific parsing failures without creating a Member", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "_bad",
        displayName: "Alice",
        biography: "",
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "handle",
      reason: "invalid-format",
    });
    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "alice",
        displayName: "   ",
        biography: "",
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "display-name",
      reason: "empty",
    });
    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "alice",
        displayName: "Alice",
        biography: "b".repeat(161),
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "biography",
      reason: "too-long",
    });

    expect(
      await backend.run(async (ctx) =>
        ctx.db.query("members").withIndex("by_externalId").take(1),
      ),
    ).toEqual([]);
  });

  test("enforces unique normalized Handle ownership under concurrent claims", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);
    const asBen = backend.withIdentity(benIdentity);

    const [alice, ben] = await Promise.all([
      asAlice.mutation(api.members.registerCurrent, {
        handle: "quiet_reader",
        displayName: "Alice",
        biography: "",
      }),
      asBen.mutation(api.members.registerCurrent, {
        handle: "quiet_reader",
        displayName: "Ben",
        biography: "",
      }),
    ]);

    expect([alice._tag, ben._tag].sort()).toEqual(["handle-unavailable", "ok"]);
  });

  test("refreshes only Clerk-owned identity imagery after registration", async () => {
    const backend = newBackend();
    const registered = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.registerCurrent, {
        handle: "alice",
        displayName: "Still Alice",
        biography: "Still-owned biography",
      });
    expect(registered._tag).toBe("ok");
    if (registered._tag !== "ok") {
      return;
    }

    await backend
      .withIdentity({
        subject: "user_alice",
        name: "Clerk Changed Name",
        pictureUrl: "https://img.clerk.com/alice-2.png",
      })
      .mutation(api.members.ensureCurrent, {});

    const profile = await backend.query(api.members.getProfile, {
      memberId: registered.profile.memberId,
    });
    expect(profile).toMatchObject({
      _tag: "ok",
      profile: {
        registrationState: "registered",
        handle: "alice",
        displayName: "Still Alice",
        biography: "Still-owned biography",
        avatarUrl: "https://img.clerk.com/alice-2.png",
      },
    });
  });
});

describe("Members registration over existing identities", () => {
  test("completes a legacy Member in place, keeping its id and Posts", async () => {
    const backend = newBackend();
    const { memberId, postId } = await backend.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        externalId: "https://convex.test|user_alice",
        displayName: "Legacy Member",
      });
      const postId = await ctx.db.insert("posts", {
        state: "active",
        kind: "standalone",
        authorId: memberId,
        content: "Published before onboarding existed.",
        likeCount: 0,
        activeReplyCount: 0,
        activeRepostCount: 0,
      });

      return { memberId, postId };
    });

    const registered = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.registerCurrent, {
        handle: "alice_reader",
        displayName: "Alice Reader",
        biography: "",
      });

    expect(registered).toEqual({
      _tag: "ok",
      profile: {
        registrationState: "registered",
        memberId,
        handle: "alice_reader",
        displayName: "Alice Reader",
        avatarUrl: "https://img.clerk.com/alice.png",
        followerCount: 0,
        followingCount: 0,
      },
    });
    await expect(
      backend.query(api.posts.listByMember, { memberId }),
    ).resolves.toMatchObject({
      _tag: "ok",
      posts: [{ postId, content: "Published before onboarding existed." }],
    });
  });

  test("folds submitted capitals and owns the Handle case-insensitively", async () => {
    const backend = newBackend();

    const alice = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.registerCurrent, {
        handle: "Quiet_Reader",
        displayName: "Alice",
        biography: "",
      });
    const ben = await backend
      .withIdentity(benIdentity)
      .mutation(api.members.registerCurrent, {
        handle: "quiet_reader",
        displayName: "Ben",
        biography: "",
      });

    expect(alice).toMatchObject({
      _tag: "ok",
      profile: { handle: "quiet_reader" },
    });
    expect(ben).toEqual({
      _tag: "handle-unavailable",
      handle: "quiet_reader",
    });
  });

  test("rejects Handles outside the permitted length", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "ab",
        displayName: "Alice",
        biography: "",
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "handle",
      reason: "too-short",
    });
    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "a".repeat(21),
        displayName: "Alice",
        biography: "",
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "handle",
      reason: "too-long",
    });
    await expect(
      asAlice.mutation(api.members.registerCurrent, {
        handle: "alice",
        displayName: "a".repeat(51),
        biography: "",
      }),
    ).resolves.toEqual({
      _tag: "invalid-profile",
      field: "display-name",
      reason: "too-long",
    });
  });
});

describe("Members.getProfile", () => {
  test("keeps pending legacy Profiles publicly readable", async () => {
    const backend = newBackend();
    const memberId = await backend.run(async (ctx) =>
      ctx.db.insert("members", {
        externalId: "https://clerk.example|legacy",
        displayName: "Legacy Member",
      }),
    );

    await expect(
      backend.query(api.members.getProfile, { memberId }),
    ).resolves.toEqual({
      _tag: "ok",
      profile: {
        registrationState: "pending",
        memberId,
        displayName: "Legacy Member",
        followerCount: 0,
        followingCount: 0,
      },
    });
  });

  test("reports a missing Member for an unknown id", async () => {
    const backend = newBackend();

    await expect(
      backend.query(api.members.getProfile, { memberId: "not-a-member-id" }),
    ).resolves.toEqual({ _tag: "member-not-found" });
  });
});
