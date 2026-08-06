/// <reference types="vite/client" />
import migrationsTest from "@convex-dev/migrations/test";
import { convexTest, type TestConvex } from "convex-test";
import type { WithoutSystemFields } from "convex/server";
import { describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  const backend = convexTest(schema, modules);
  migrationsTest.register(backend);
  return backend;
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

async function publish(
  backend: TestConvex<typeof schema>,
  identity: { subject: string; name?: string },
  content: string,
): Promise<Id<"posts">> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.posts.create, { content });

  if (outcome._tag !== "ok") {
    throw new Error(`Expected a published Post, got ${outcome._tag}`);
  }

  return outcome.postId;
}

async function ensureMember(
  backend: TestConvex<typeof schema>,
  identity: { subject: string; name?: string },
): Promise<Id<"members">> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.members.ensureCurrent, {});

  if (outcome._tag !== "ok") {
    throw new Error(`Expected a projected Member, got ${outcome._tag}`);
  }

  return outcome.memberId;
}

describe("Posts.create", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();

    const outcome = await backend.mutation(api.posts.create, {
      content: "A quiet thought.",
    });

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("rejects whitespace-only content as empty", async () => {
    const backend = newBackend();

    const outcome = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.create, { content: "  \n\t " });

    expect(outcome).toEqual({ _tag: "invalid-content", reason: "empty" });
  });

  test("rejects 281 trimmed characters and accepts 280", async () => {
    const backend = newBackend();
    const asAlice = backend.withIdentity(aliceIdentity);

    const tooLong = await asAlice.mutation(api.posts.create, {
      content: "a".repeat(281),
    });
    expect(tooLong).toEqual({ _tag: "invalid-content", reason: "too-long" });

    const atLimit = await asAlice.mutation(api.posts.create, {
      content: "a".repeat(280),
    });
    expect(atLimit._tag).toBe("ok");
  });

  test("trims outer whitespace and preserves internal line breaks", async () => {
    const backend = newBackend();

    await publish(backend, aliceIdentity, "  First line.\n\n  Second line.  ");

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0]?.content).toBe("First line.\n\n  Second line.");
  });

  test("publishes a Post with author identity and zero Likes", async () => {
    const backend = newBackend();

    const postId = await publish(backend, aliceIdentity, "A first thought.");

    const feed = await backend
      .withIdentity(aliceIdentity)
      .query(api.posts.listFeed, {});
    expect(feed.posts).toHaveLength(1);
    const post = feed.posts[0];
    expect(post).toMatchObject({
      postId,
      kind: "standalone",
      content: "A first thought.",
      likeCount: 0,
      activeReplyCount: 0,
      activeRepostCount: 0,
      viewerHasLiked: false,
      viewerCanDelete: true,
    });
    expect(post?.author.displayName).toBe("Alice Reader");
    expect(post?.author.avatarUrl).toBe("https://img.clerk.com/alice.png");
    expect(typeof post?.publishedAt).toBe("number");

    const storedPost = await backend.run(async (ctx) =>
      ctx.db.get("posts", postId),
    );
    expect(storedPost).toMatchObject({
      state: "active",
      kind: "standalone",
      activeReplyCount: 0,
      activeRepostCount: 0,
    });
  });
});

describe("Posts.listFeed", () => {
  test("returns an empty complete Feed without authentication", async () => {
    const backend = newBackend();

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed).toEqual({ posts: [], ending: "complete" });
  });

  test("orders Posts newest first for signed-out readers", async () => {
    const backend = newBackend();
    await publish(backend, aliceIdentity, "First");
    await publish(backend, benIdentity, "Second");
    await publish(backend, aliceIdentity, "Third");

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed.posts.map((post) => post.content)).toEqual([
      "Third",
      "Second",
      "First",
    ]);
    expect(feed.ending).toBe("complete");
    expect(
      feed.posts.every((post) => !post.viewerHasLiked && !post.viewerCanDelete),
    ).toBe(true);
  });

  test("interprets legacy rows as active Standalone Posts", async () => {
    const backend = newBackend();
    const memberId = await ensureMember(backend, aliceIdentity);
    const legacyPostId = await backend.run(async (ctx) =>
      ctx.db.insert("posts", {
        authorId: memberId,
        content: "Written before relational Posts.",
        likeCount: 0,
      }),
    );

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed.posts).toEqual([
      expect.objectContaining({
        postId: legacyPostId,
        kind: "standalone",
        content: "Written before relational Posts.",
        activeReplyCount: 0,
        activeRepostCount: 0,
      }),
    ]);

    const profile = await backend.query(api.posts.listByMember, {
      memberId,
    });
    expect(profile).toMatchObject({
      _tag: "ok",
      posts: [expect.objectContaining({ postId: legacyPostId })],
    });
  });

  test("selects eligible Standalone Posts before applying the Feed limit", async () => {
    const backend = newBackend();
    const memberId = await ensureMember(backend, aliceIdentity);
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "The Feed-visible source.",
    );

    await backend.run(async (ctx) => {
      for (let index = 1; index <= 51; index += 1) {
        await ctx.db.insert("posts", {
          state: "active",
          kind: "reply",
          authorId: memberId,
          content: `Reply ${index}`,
          likeCount: 0,
          activeReplyCount: 0,
          activeRepostCount: 0,
          parentPostId: sourcePostId,
          conversationRootId: sourcePostId,
        });
      }
    });

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed.posts.map((post) => post.postId)).toEqual([sourcePostId]);
    expect(feed.ending).toBe("complete");
  });

  test("rejects invalid kind and relationship combinations at persistence", async () => {
    const backend = newBackend();
    const memberId = await ensureMember(backend, aliceIdentity);

    // SAFETY: This test intentionally bypasses the generated insert type to
    // prove the runtime schema rejects a Standalone Post carrying Reply fields.
    const invalidPost = {
      state: "active",
      kind: "standalone",
      authorId: memberId,
      content: "Invalid relation.",
      likeCount: 0,
      activeReplyCount: 0,
      activeRepostCount: 0,
      parentPostId: "not-a-post-id",
      conversationRootId: "not-a-post-id",
    } as unknown as WithoutSystemFields<DataModel["posts"]["document"]>;

    await expect(
      backend.run(async (ctx) => ctx.db.insert("posts", invalidPost)),
    ).rejects.toThrow();
  });

  test("marks exactly 50 Posts as a complete Feed", async () => {
    const backend = newBackend();
    for (let index = 1; index <= 50; index += 1) {
      await publish(backend, aliceIdentity, `Post ${index}`);
    }

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed.posts).toHaveLength(50);
    expect(feed.ending).toBe("complete");
  });

  test("renders at most 50 Posts and marks older Posts as truncated", async () => {
    const backend = newBackend();
    for (let index = 1; index <= 51; index += 1) {
      await publish(backend, aliceIdentity, `Post ${index}`);
    }

    const feed = await backend.query(api.posts.listFeed, {});

    expect(feed.posts).toHaveLength(50);
    expect(feed.ending).toBe("truncated");
    expect(feed.posts[0]?.content).toBe("Post 51");
    expect(feed.posts[49]?.content).toBe("Post 2");
  });
});

describe("Posts relational migration", () => {
  test("backfills legacy Posts idempotently without changing public results", async () => {
    const backend = newBackend();
    const memberId = await ensureMember(backend, aliceIdentity);
    const legacyPostId = await backend.run(async (ctx) =>
      ctx.db.insert("posts", {
        authorId: memberId,
        content: "Keep this thought unchanged.",
        likeCount: 0,
      }),
    );
    const before = await backend.query(api.posts.listFeed, {});

    await backend.mutation(internal.migrations.backfillLegacyPosts, {});
    await backend.mutation(internal.migrations.backfillLegacyPosts, {
      reset: true,
    });

    const storedPost = await backend.run(async (ctx) =>
      ctx.db.get("posts", legacyPostId),
    );
    expect(storedPost).toMatchObject({
      authorId: memberId,
      content: "Keep this thought unchanged.",
      likeCount: 0,
      state: "active",
      kind: "standalone",
      activeReplyCount: 0,
      activeRepostCount: 0,
    });
    const after = await backend.query(api.posts.listFeed, {});
    expect(after).toEqual(before);
  });
});

describe("Posts.toggleLike", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "A thought.");

    const outcome = await backend.mutation(api.posts.toggleLike, { postId });

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("reports a missing Post", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Ephemeral.");
    await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.remove, { postId });

    const outcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleLike, { postId });

    expect(outcome).toEqual({ _tag: "post-not-found" });
  });

  test("creates and removes a Like with a consistent count", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Like me once.");
    const asBen = backend.withIdentity(benIdentity);

    const liked = await asBen.mutation(api.posts.toggleLike, { postId });
    expect(liked).toEqual({ _tag: "ok", state: "liked", likeCount: 1 });

    const likedFeed = await asBen.query(api.posts.listFeed, {});
    expect(likedFeed.posts[0]).toMatchObject({
      likeCount: 1,
      viewerHasLiked: true,
    });

    const unliked = await asBen.mutation(api.posts.toggleLike, { postId });
    expect(unliked).toEqual({ _tag: "ok", state: "unliked", likeCount: 0 });

    const unlikedFeed = await asBen.query(api.posts.listFeed, {});
    expect(unlikedFeed.posts[0]).toMatchObject({
      likeCount: 0,
      viewerHasLiked: false,
    });
  });

  test("never stores more than one Like per Member/Post pair", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Toggle rapidly.");
    const asBen = backend.withIdentity(benIdentity);

    await asBen.mutation(api.posts.toggleLike, { postId });
    await asBen.mutation(api.posts.toggleLike, { postId });
    await asBen.mutation(api.posts.toggleLike, { postId });

    const likes = await backend.run(async (ctx) => {
      return await ctx.db.query("likes").collect();
    });
    expect(likes).toHaveLength(1);

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts[0]?.likeCount).toBe(1);
  });

  test("counts Likes from independent Members separately", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Widely liked.");

    await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.toggleLike, { postId });
    await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleLike, { postId });

    const asAliceFeed = await backend
      .withIdentity(aliceIdentity)
      .query(api.posts.listFeed, {});
    expect(asAliceFeed.posts[0]).toMatchObject({
      likeCount: 2,
      viewerHasLiked: true,
    });

    await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleLike, { postId });

    const afterBenUnliked = await backend
      .withIdentity(aliceIdentity)
      .query(api.posts.listFeed, {});
    expect(afterBenUnliked.posts[0]).toMatchObject({
      likeCount: 1,
      viewerHasLiked: true,
    });
  });
});

describe("Posts.remove", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Keep me.");

    const outcome = await backend.mutation(api.posts.remove, { postId });

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("forbids deleting another Member's Post", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Alice's Post.");

    const outcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.remove, { postId });

    expect(outcome).toEqual({ _tag: "forbidden" });
    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts).toHaveLength(1);
  });

  test("reports a missing Post", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Gone soon.");
    const asAlice = backend.withIdentity(aliceIdentity);

    await asAlice.mutation(api.posts.remove, { postId });
    const outcome = await asAlice.mutation(api.posts.remove, { postId });

    expect(outcome).toEqual({ _tag: "post-not-found" });
  });

  test("lets the author delete and cascades associated Likes", async () => {
    const backend = newBackend();
    const removedId = await publish(backend, aliceIdentity, "Delete me.");
    const keptId = await publish(backend, benIdentity, "Keep me.");

    await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.toggleLike, { postId: removedId });
    await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleLike, { postId: removedId });
    await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.toggleLike, { postId: keptId });

    const outcome = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.remove, { postId: removedId });
    expect(outcome).toEqual({ _tag: "ok" });

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts.map((post) => post.postId)).toEqual([keptId]);

    const remainingLikes = await backend.run(async (ctx) => {
      return await ctx.db.query("likes").collect();
    });
    expect(remainingLikes).toHaveLength(1);
    expect(remainingLikes[0]?.postId).toBe(keptId);
  });
});

describe("Posts.listByMember", () => {
  test("reports a missing Member for an unknown id", async () => {
    const backend = newBackend();

    const outcome = await backend.query(api.posts.listByMember, {
      memberId: "not-a-member-id",
    });

    expect(outcome).toEqual({ _tag: "member-not-found" });
  });

  test("returns only the requested Member's Posts, newest first", async () => {
    const backend = newBackend();
    await publish(backend, aliceIdentity, "Alice one");
    await publish(backend, benIdentity, "Ben one");
    await publish(backend, aliceIdentity, "Alice two");

    const feed = await backend.query(api.posts.listFeed, {});
    const aliceMemberId = feed.posts.find(
      (post) => post.author.displayName === "Alice Reader",
    )?.author.memberId;
    expect(aliceMemberId).toBeDefined();
    if (aliceMemberId === undefined) {
      return;
    }

    const outcome = await backend.query(api.posts.listByMember, {
      memberId: aliceMemberId,
    });

    expect(outcome._tag).toBe("ok");
    if (outcome._tag !== "ok") {
      return;
    }
    expect(outcome.posts.map((post) => post.content)).toEqual([
      "Alice two",
      "Alice one",
    ]);
    expect(outcome.ending).toBe("complete");
    expect(
      outcome.posts.every((post) => post.author.memberId === aliceMemberId),
    ).toBe(true);
  });

  test("includes complete display models with viewer Like state", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "On my Profile.");
    await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleLike, { postId });

    const feed = await backend.query(api.posts.listFeed, {});
    const aliceMemberId = feed.posts[0]?.author.memberId;
    expect(aliceMemberId).toBeDefined();
    if (aliceMemberId === undefined) {
      return;
    }

    const asBen = await backend
      .withIdentity(benIdentity)
      .query(api.posts.listByMember, { memberId: aliceMemberId });

    expect(asBen._tag).toBe("ok");
    if (asBen._tag !== "ok") {
      return;
    }
    expect(asBen.posts[0]).toMatchObject({
      postId,
      content: "On my Profile.",
      likeCount: 1,
      viewerHasLiked: true,
      viewerCanDelete: false,
    });
  });

  test("truncates a Member's Posts beyond 50", async () => {
    const backend = newBackend();
    for (let index = 1; index <= 51; index += 1) {
      await publish(backend, aliceIdentity, `Post ${index}`);
    }

    const feed = await backend.query(api.posts.listFeed, {});
    const aliceMemberId = feed.posts[0]?.author.memberId;
    expect(aliceMemberId).toBeDefined();
    if (aliceMemberId === undefined) {
      return;
    }

    const outcome = await backend.query(api.posts.listByMember, {
      memberId: aliceMemberId,
    });

    expect(outcome._tag).toBe("ok");
    if (outcome._tag !== "ok") {
      return;
    }
    expect(outcome.posts).toHaveLength(50);
    expect(outcome.ending).toBe("truncated");
  });
});
