/// <reference types="vite/client" />
import migrationsTest from "@convex-dev/migrations/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  const backend = convexTest(schema, modules);
  migrationsTest.register(backend);
  return backend;
}

describe("social schema expansion", () => {
  test("keeps pre-expansion Members and Posts publicly readable", async () => {
    const backend = newBackend();
    const { memberId, postId } = await backend.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        externalId: "https://clerk.example|legacy",
        displayName: "Legacy Member",
      });
      const postId = await ctx.db.insert("posts", {
        state: "active",
        kind: "standalone",
        authorId: memberId,
        content: "Published before the social expansion.",
        likeCount: 0,
        activeReplyCount: 0,
        activeRepostCount: 0,
      });

      return { memberId, postId };
    });

    const profile = await backend.query(api.members.getProfile, { memberId });
    const feed = await backend.query(api.posts.listFeed, {});

    expect(profile).toEqual({
      _tag: "ok",
      viewerFollow: "unavailable",
      profile: {
        registrationState: "pending",
        memberId,
        displayName: "Legacy Member",
        followerCount: 0,
        followingCount: 0,
      },
    });
    expect(feed.posts).toEqual([
      expect.objectContaining({
        postId,
        content: "Published before the social expansion.",
      }),
    ]);
  });

  test("keeps expanded Members and Posts readable beside legacy records", async () => {
    const backend = newBackend();
    const { memberId, postId, repostId, tombstoneId } = await backend.run(
      async (ctx) => {
        const memberId = await ctx.db.insert("members", {
          externalId: "https://clerk.example|expanded",
          displayName: "Expanded Member",
          registrationState: "registered",
          handle: "expanded",
          normalizedHandle: "expanded",
          biography: "Registered after the expansion.",
          followerCount: 3,
          followingCount: 2,
          searchText: "expanded expanded member",
        });
        const postId = await ctx.db.insert("posts", {
          state: "active",
          kind: "standalone",
          authorId: memberId,
          content: "Published after the social expansion.",
          revision: 4,
          editedAt: Date.now(),
          likeCount: 0,
          activeReplyCount: 0,
          activeRepostCount: 1,
        });
        const repostId = await ctx.db.insert("posts", {
          state: "active",
          kind: "repost",
          authorId: memberId,
          sourcePostId: postId,
        });
        const tombstoneId = await ctx.db.insert("posts", {
          state: "deleted",
          kind: "standalone",
          activeReplyCount: 0,
          activeRepostCount: 0,
        });

        return { memberId, postId, repostId, tombstoneId };
      },
    );

    await backend.mutation(internal.socialMigrations.backfillMembers, {});
    await backend.mutation(internal.socialMigrations.backfillPosts, {});

    const profile = await backend.query(api.members.getProfile, { memberId });
    const records = await backend.run(async (ctx) => ({
      post: await ctx.db.get("posts", postId),
      repost: await ctx.db.get("posts", repostId),
      tombstone: await ctx.db.get("posts", tombstoneId),
    }));

    expect(profile).toEqual({
      _tag: "ok",
      viewerFollow: "unavailable",
      profile: {
        registrationState: "registered",
        memberId,
        handle: "expanded",
        displayName: "Expanded Member",
        biography: "Registered after the expansion.",
        followerCount: 3,
        followingCount: 2,
      },
    });
    // The backfill only fills absent revisions, and content-free records have
    // nothing to revise, so their exact stored shape must be unchanged.
    expect(records.post).toMatchObject({ revision: 4 });
    expect(records.repost).toEqual({
      _id: repostId,
      _creationTime: expect.any(Number),
      state: "active",
      kind: "repost",
      authorId: memberId,
      sourcePostId: postId,
    });
    expect(records.tombstone).toEqual({
      _id: tombstoneId,
      _creationTime: expect.any(Number),
      state: "deleted",
      kind: "standalone",
      activeReplyCount: 0,
      activeRepostCount: 0,
    });
  });

  test("backfills compatible Member and Post fields idempotently", async () => {
    const backend = newBackend();
    const { memberId, postId } = await backend.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        externalId: "https://clerk.example|pending",
        displayName: "  Pending   Member  ",
      });
      const postId = await ctx.db.insert("posts", {
        state: "active",
        kind: "standalone",
        authorId: memberId,
        content: "Keep this content unchanged.",
        likeCount: 0,
        activeReplyCount: 0,
        activeRepostCount: 0,
      });

      return { memberId, postId };
    });

    await backend.mutation(internal.socialMigrations.backfillMembers, {});
    await backend.mutation(internal.socialMigrations.backfillPosts, {});
    await backend.mutation(internal.socialMigrations.backfillMembers, {
      reset: true,
    });
    await backend.mutation(internal.socialMigrations.backfillPosts, {
      reset: true,
    });

    const records = await backend.run(async (ctx) => ({
      member: await ctx.db.get("members", memberId),
      post: await ctx.db.get("posts", postId),
    }));

    expect(records.member).toMatchObject({
      registrationState: "pending",
      followerCount: 0,
      followingCount: 0,
      searchText: "pending member",
    });
    expect(records.post).toMatchObject({
      revision: 0,
      content: "Keep this content unchanged.",
    });
  });
});
