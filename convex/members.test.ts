/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  return convexTest(schema, modules);
}

const aliceIdentity = {
  subject: "user_alice",
  name: "Alice Reader",
  pictureUrl: "https://img.clerk.com/alice.png",
} as const;

describe("Members.ensureCurrent", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();

    const outcome = await backend.mutation(api.members.ensureCurrent, {});

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("projects a new Clerk identity into a Member", async () => {
    const backend = newBackend();

    const outcome = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.ensureCurrent, {});

    expect(outcome._tag).toBe("ok");
    if (outcome._tag !== "ok") {
      return;
    }

    const profile = await backend.query(api.members.getProfile, {
      memberId: outcome.memberId,
    });

    expect(profile).toEqual({
      _tag: "ok",
      profile: {
        memberId: outcome.memberId,
        displayName: "Alice Reader",
        avatarUrl: "https://img.clerk.com/alice.png",
      },
    });
  });

  test("is idempotent for repeated entries by the same identity", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    const first = await asAlice.mutation(api.members.ensureCurrent, {});
    const second = await asAlice.mutation(api.members.ensureCurrent, {});

    expect(first).toEqual(second);
    const memberCount = await backend.run(async (ctx) => {
      const members = await ctx.db.query("members").collect();
      return members.length;
    });
    expect(memberCount).toBe(1);
  });

  test("refreshes the projected display name and avatar on return", async () => {
    const backend = newBackend();

    const created = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.ensureCurrent, {});
    expect(created._tag).toBe("ok");
    if (created._tag !== "ok") {
      return;
    }

    await backend
      .withIdentity({
        subject: "user_alice",
        name: "Alice Stillwater",
        pictureUrl: "https://img.clerk.com/alice-2.png",
      })
      .mutation(api.members.ensureCurrent, {});

    const profile = await backend.query(api.members.getProfile, {
      memberId: created.memberId,
    });

    expect(profile).toEqual({
      _tag: "ok",
      profile: {
        memberId: created.memberId,
        displayName: "Alice Stillwater",
        avatarUrl: "https://img.clerk.com/alice-2.png",
      },
    });
  });

  test("projects a fallback display name when Clerk supplies none", async () => {
    const backend = newBackend();

    const outcome = await backend
      .withIdentity({ subject: "user_quiet" })
      .mutation(api.members.ensureCurrent, {});

    expect(outcome._tag).toBe("ok");
    if (outcome._tag !== "ok") {
      return;
    }

    const profile = await backend.query(api.members.getProfile, {
      memberId: outcome.memberId,
    });

    expect(profile).toEqual({
      _tag: "ok",
      profile: {
        memberId: outcome.memberId,
        displayName: "Member",
      },
    });
  });
});

describe("Members.getProfile", () => {
  test("is publicly readable without authentication", async () => {
    const backend = newBackend();

    const created = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.ensureCurrent, {});
    expect(created._tag).toBe("ok");
    if (created._tag !== "ok") {
      return;
    }

    const profile = await backend.query(api.members.getProfile, {
      memberId: created.memberId,
    });

    expect(profile._tag).toBe("ok");
  });

  test("reports a missing Member for an unknown id", async () => {
    const backend = newBackend();

    const profile = await backend.query(api.members.getProfile, {
      memberId: "not-a-member-id",
    });

    expect(profile).toEqual({ _tag: "member-not-found" });
  });
});
