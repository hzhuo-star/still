/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import type { WithoutSystemFields } from "convex/server";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import type { PostView, StandalonePostView } from "../contract/post";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  return convexTest(schema, modules);
}

function standalonePosts(
  posts: ReadonlyArray<PostView>,
): ReadonlyArray<StandalonePostView> {
  return posts.filter(
    (post): post is StandalonePostView => post.kind === "standalone",
  );
}

/** The Clerk-shaped identity fields these fixtures rely on. */
type TestIdentity = {
  readonly subject: string;
  readonly name?: string;
};

const aliceIdentity = {
  subject: "user_alice",
  name: "Alice Reader",
  pictureUrl: "https://img.clerk.com/alice.png",
} as const;

const benIdentity = {
  subject: "user_ben",
  name: "Ben Quiet",
} as const;

/**
 * Complete Member Registration for a test identity. Member-only mutations
 * require a registered Member, so every fixture that acts registers first.
 */
async function registerMember(
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

/** Return a registered identity's backend, registering it when needed. */
async function asMember(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
): Promise<ReturnType<TestConvex<typeof schema>["withIdentity"]>> {
  await registerMember(backend, identity);
  return backend.withIdentity(identity);
}

async function publish(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
  content: string,
): Promise<Id<"posts">> {
  const outcome = await (
    await asMember(backend, identity)
  ).mutation(api.posts.create, { content });

  if (outcome._tag !== "ok") {
    throw new Error(`Expected a published Post, got ${outcome._tag}`);
  }

  return outcome.postId;
}

async function publishReply(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
  parentPostId: Id<"posts">,
  content: string,
): Promise<Id<"posts">> {
  const outcome = await (
    await asMember(backend, identity)
  ).mutation(api.posts.createReply, { parentPostId, content });

  if (outcome._tag !== "ok") {
    throw new Error(`Expected a published Reply, got ${outcome._tag}`);
  }

  return outcome.postId;
}

async function publishQuote(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
  targetPostId: Id<"posts">,
  commentary: string,
): Promise<Id<"posts">> {
  const outcome = await (
    await asMember(backend, identity)
  ).mutation(api.posts.createQuote, { targetPostId, commentary });

  if (outcome._tag !== "ok" || outcome.kind !== "quote") {
    throw new Error(`Expected a published Quote Post, got ${outcome._tag}`);
  }

  return outcome.postId;
}

describe("Member-only Post mutations", () => {
  test("refuse an authenticated identity that has not registered", async () => {
    const backend = newBackend();
    const postId = await publish(
      backend,
      aliceIdentity,
      "A registered Member's thought.",
    );
    const awaitingOnboarding = backend.withIdentity(benIdentity);
    await awaitingOnboarding.mutation(api.members.ensureCurrent, {});

    const outcomes = [
      await awaitingOnboarding.mutation(api.posts.create, {
        content: "Not a Member yet.",
      }),
      await awaitingOnboarding.mutation(api.posts.createReply, {
        parentPostId: postId,
        content: "Not a Member yet.",
      }),
      await awaitingOnboarding.mutation(api.posts.createQuote, {
        targetPostId: postId,
        commentary: "",
      }),
      await awaitingOnboarding.mutation(api.posts.toggleLike, { postId }),
      await awaitingOnboarding.mutation(api.posts.toggleRepost, { postId }),
      await awaitingOnboarding.mutation(api.posts.remove, { postId }),
    ];

    expect(outcomes).toEqual([
      { _tag: "registration-required" },
      { _tag: "registration-required" },
      { _tag: "registration-required" },
      { _tag: "registration-required" },
      { _tag: "registration-required" },
      { _tag: "registration-required" },
    ]);
  });

  test("keep public reads available while onboarding is outstanding", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Still readable.");
    const awaitingOnboarding = backend.withIdentity(benIdentity);
    await awaitingOnboarding.mutation(api.members.ensureCurrent, {});

    const feed = await awaitingOnboarding.query(api.posts.listFeed, {});

    expect(feed).toMatchObject({
      ending: "complete",
      posts: [
        {
          postId,
          content: "Still readable.",
          likeCount: 0,
          viewerHasLiked: false,
          viewerCanDelete: false,
        },
      ],
    });
  });
});

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

    const outcome = await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.create, { content: "  \n\t " });

    expect(outcome).toEqual({ _tag: "invalid-content", reason: "empty" });
  });

  test("rejects 281 trimmed characters and accepts 280", async () => {
    const backend = newBackend();
    const asAlice = await asMember(backend, aliceIdentity);

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
    expect(standalonePosts(feed.posts)[0]?.content).toBe(
      "First line.\n\n  Second line.",
    );
  });

  test("publishes a Post with author identity and zero Likes", async () => {
    const backend = newBackend();

    const postId = await publish(backend, aliceIdentity, "A first thought.");

    const feed = await (
      await asMember(backend, aliceIdentity)
    ).query(api.posts.listFeed, {});
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

describe("Posts.createReply", () => {
  test("publishes a Reply with its direct parent and Conversation root", async () => {
    const backend = newBackend();
    const rootPostId = await publish(backend, aliceIdentity, "A root thought.");

    const replyPostId = await publishReply(
      backend,
      benIdentity,
      rootPostId,
      "  A direct Reply.  ",
    );

    const conversation = await backend.query(api.posts.getConversation, {
      postId: replyPostId,
    });
    expect(conversation).toMatchObject({
      _tag: "ok",
      requestedPostId: replyPostId,
      root: { _tag: "active", post: { postId: rootPostId } },
      replies: [
        {
          _tag: "active",
          post: {
            postId: replyPostId,
            kind: "reply",
            content: "A direct Reply.",
            parentPostId: rootPostId,
            conversationRootId: rootPostId,
          },
        },
      ],
      ending: "complete",
    });
  });

  test("returns precise outcomes for authentication, content, and target eligibility", async () => {
    const backend = newBackend();
    const activePostId = await publish(
      backend,
      aliceIdentity,
      "An eligible Post.",
    );

    await expect(
      backend.mutation(api.posts.createReply, {
        parentPostId: activePostId,
        content: "Signed out.",
      }),
    ).resolves.toEqual({ _tag: "unauthenticated" });
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createReply, {
        parentPostId: activePostId,
        content: "   ",
      }),
    ).resolves.toEqual({ _tag: "invalid-content", reason: "empty" });

    const missingPostId = await publish(
      backend,
      aliceIdentity,
      "Hard deleted only to create a missing id.",
    );
    await backend.run(async (ctx) => await ctx.db.delete(missingPostId));
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createReply, {
        parentPostId: missingPostId,
        content: "Missing target.",
      }),
    ).resolves.toEqual({ _tag: "target-not-found" });

    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: activePostId });
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createReply, {
        parentPostId: activePostId,
        content: "Deleted target.",
      }),
    ).resolves.toEqual({ _tag: "target-deleted" });

    const memberId = await registerMember(backend, aliceIdentity);
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "A Repost source.",
    );
    const repostId = await backend.run(async (ctx) =>
      ctx.db.insert("posts", {
        state: "active",
        kind: "repost",
        authorId: memberId,
        sourcePostId,
      }),
    );
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createReply, {
        parentPostId: repostId,
        content: "Wrapper target.",
      }),
    ).resolves.toEqual({ _tag: "target-is-repost" });
  });

  test("derives nested roots and maintains active direct Reply counts", async () => {
    const backend = newBackend();
    const rootPostId = await publish(backend, aliceIdentity, "Root");
    const directReplyId = await publishReply(
      backend,
      benIdentity,
      rootPostId,
      "Direct",
    );
    const nestedReplyId = await publishReply(
      backend,
      aliceIdentity,
      directReplyId,
      "Nested",
    );

    const beforeDelete = await backend.query(api.posts.getConversation, {
      postId: rootPostId,
    });
    expect(beforeDelete).toMatchObject({
      _tag: "ok",
      root: { _tag: "active", post: { activeReplyCount: 1 } },
      replies: [
        {
          _tag: "active",
          post: {
            postId: directReplyId,
            activeReplyCount: 1,
            conversationRootId: rootPostId,
          },
        },
        {
          _tag: "active",
          post: {
            postId: nestedReplyId,
            activeReplyCount: 0,
            parentPostId: directReplyId,
            conversationRootId: rootPostId,
          },
        },
      ],
    });

    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.remove, { postId: directReplyId });
    const afterDelete = await backend.query(api.posts.getConversation, {
      postId: directReplyId,
    });
    expect(afterDelete).toMatchObject({
      _tag: "ok",
      requestedPostId: directReplyId,
      root: { _tag: "active", post: { activeReplyCount: 0 } },
      replies: [
        { _tag: "tombstone", post: { postId: directReplyId } },
        {
          _tag: "active",
          post: { postId: nestedReplyId, conversationRootId: rootPostId },
        },
      ],
    });
  });

  test("allows active Quote Posts as Reply targets", async () => {
    const backend = newBackend();
    const memberId = await registerMember(backend, aliceIdentity);
    const referencedPostId = await publish(
      backend,
      aliceIdentity,
      "Referenced",
    );
    const quotePostId = await backend.run(async (ctx) =>
      ctx.db.insert("posts", {
        state: "active",
        kind: "quote",
        authorId: memberId,
        content: "Commentary",
        likeCount: 0,
        activeReplyCount: 0,
        activeRepostCount: 0,
        referencedPostId,
      }),
    );

    const replyPostId = await publishReply(
      backend,
      benIdentity,
      quotePostId,
      "Replying to a Quote Post.",
    );
    const conversation = await backend.query(api.posts.getConversation, {
      postId: replyPostId,
    });

    expect(conversation).toMatchObject({
      _tag: "ok",
      root: {
        _tag: "active",
        post: { postId: quotePostId, kind: "quote", activeReplyCount: 1 },
      },
      replies: [{ _tag: "active", post: { postId: replyPostId } }],
    });
  });
});

describe("Posts.createQuote", () => {
  test("returns precise authentication, content, and target outcomes", async () => {
    const backend = newBackend();
    const targetPostId = await publish(backend, aliceIdentity, "Quote target");

    await expect(
      backend.mutation(api.posts.createQuote, {
        targetPostId,
        commentary: "Signed out commentary",
      }),
    ).resolves.toEqual({ _tag: "unauthenticated" });
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createQuote, {
        targetPostId,
        commentary: "a".repeat(281),
      }),
    ).resolves.toEqual({ _tag: "invalid-content", reason: "too-long" });

    const missingPostId = await publish(backend, aliceIdentity, "Missing");
    await backend.run(async (ctx) => await ctx.db.delete(missingPostId));
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createQuote, {
        targetPostId: missingPostId,
        commentary: "Cannot quote this",
      }),
    ).resolves.toEqual({ _tag: "target-not-found" });

    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: targetPostId });
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createQuote, {
        targetPostId,
        commentary: "Cannot quote a tombstone",
      }),
    ).resolves.toEqual({ _tag: "target-deleted" });
  });

  test("publishes repeat Quote Posts with one shallow direct preview", async () => {
    const backend = newBackend();
    const rootPostId = await publish(backend, aliceIdentity, "Root source");
    const replyPostId = await publishReply(
      backend,
      benIdentity,
      rootPostId,
      "Selected Reply",
    );
    const firstQuoteId = await publishQuote(
      backend,
      aliceIdentity,
      replyPostId,
      "First commentary",
    );
    const secondQuoteId = await publishQuote(
      backend,
      aliceIdentity,
      firstQuoteId,
      "Second commentary",
    );
    await publishQuote(
      backend,
      aliceIdentity,
      replyPostId,
      "Another distinct thought",
    );

    const feed = await backend.query(api.posts.listFeed, {});
    const firstQuote = feed.posts.find((post) => post.postId === firstQuoteId);
    const secondQuote = feed.posts.find(
      (post) => post.postId === secondQuoteId,
    );

    expect(firstQuote).toMatchObject({
      kind: "quote",
      content: "First commentary",
      reference: {
        _tag: "available",
        post: {
          postId: replyPostId,
          kind: "reply",
          content: "Selected Reply",
          author: { displayName: "Ben Quiet" },
        },
      },
    });
    expect(secondQuote).toMatchObject({
      kind: "quote",
      reference: {
        _tag: "available",
        post: {
          postId: firstQuoteId,
          kind: "quote",
          content: "First commentary",
        },
      },
    });
    expect(JSON.stringify(secondQuote)).not.toContain("Selected Reply");
    expect(
      feed.posts.filter(
        (post) =>
          post.kind === "quote" && post.referencedPostId === replyPostId,
      ),
    ).toHaveLength(2);
  });

  test("normalizes Repost targets and delegates blank commentary once", async () => {
    const backend = newBackend();
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "Ultimate source",
    );
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });
    const feed = await backend.query(api.posts.listFeed, {});
    const wrapper = feed.posts.find((post) => post.kind === "repost");
    expect(wrapper).toBeDefined();
    if (wrapper === undefined) {
      return;
    }

    const quotePostId = await publishQuote(
      backend,
      benIdentity,
      wrapper.postId,
      "Normalized commentary",
    );
    const storedQuote = await backend.run(async (ctx) =>
      ctx.db.get("posts", quotePostId),
    );
    expect(storedQuote).toMatchObject({
      kind: "quote",
      referencedPostId: sourcePostId,
    });

    const blank = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.createQuote, {
      targetPostId: wrapper.postId,
      commentary: "  \n ",
    });
    expect(blank).toMatchObject({
      _tag: "ok",
      kind: "repost",
      activeRepostCount: 2,
    });
    await expect(
      (await asMember(backend, benIdentity)).mutation(api.posts.createQuote, {
        targetPostId: sourcePostId,
        commentary: "",
      }),
    ).resolves.toEqual({ _tag: "already-reposted" });
  });

  test("keeps a Quote Post active when its preview becomes unavailable", async () => {
    const backend = newBackend();
    const targetPostId = await publish(backend, aliceIdentity, "Delete target");
    const quotePostId = await publishQuote(
      backend,
      benIdentity,
      targetPostId,
      "Independent commentary",
    );
    const replyPostId = await publishReply(
      backend,
      aliceIdentity,
      quotePostId,
      "Reply to Quote Post",
    );
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleLike, { postId: quotePostId });
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: targetPostId });

    const feed = await backend.query(api.posts.listFeed, {});
    expect(
      feed.posts.find((post) => post.postId === quotePostId),
    ).toMatchObject({
      kind: "quote",
      likeCount: 1,
      activeReplyCount: 1,
      reference: { _tag: "unavailable" },
    });
    expect(JSON.stringify(feed)).not.toContain("Delete target");

    const conversation = await backend.query(api.posts.getConversation, {
      postId: quotePostId,
    });
    expect(conversation).toMatchObject({
      _tag: "ok",
      root: { _tag: "active", post: { postId: quotePostId, kind: "quote" } },
      replies: [{ _tag: "active", post: { postId: replyPostId } }],
    });
  });
});

describe("Posts.getConversation", () => {
  test("keeps public reads bounded, chronological, and honest", async () => {
    const backend = newBackend();
    const rootPostId = await publish(backend, aliceIdentity, "Root");
    const replyIds: Array<Id<"posts">> = [];
    for (let index = 1; index <= 52; index += 1) {
      replyIds.push(
        await publishReply(
          backend,
          index % 2 === 0 ? aliceIdentity : benIdentity,
          rootPostId,
          `Reply ${index}`,
        ),
      );
    }

    const normal = await backend.query(api.posts.getConversation, {
      postId: rootPostId,
    });
    expect(normal._tag).toBe("ok");
    if (normal._tag !== "ok") {
      return;
    }
    expect(normal.replies).toHaveLength(50);
    expect(normal.ending).toBe("truncated");
    expect(
      normal.replies.map((entry) =>
        entry._tag === "active" ? entry.post.content : "deleted",
      ),
    ).toEqual(Array.from({ length: 50 }, (_, index) => `Reply ${index + 3}`));

    const oldestReplyId = replyIds[0];
    expect(oldestReplyId).toBeDefined();
    if (oldestReplyId === undefined) {
      return;
    }
    const deepLinked = await backend.query(api.posts.getConversation, {
      postId: oldestReplyId,
    });
    expect(deepLinked._tag).toBe("ok");
    if (deepLinked._tag !== "ok") {
      return;
    }
    expect(deepLinked.replies).toHaveLength(50);
    expect(deepLinked.ending).toBe("truncated");
    expect(deepLinked.requestedPostId).toBe(oldestReplyId);
    expect(deepLinked.requestedReplyWasOutsideWindow).toBe(true);
    expect(
      deepLinked.replies.some((entry) => entry.post.postId === oldestReplyId),
    ).toBe(true);
  });

  test("reports invalid, missing, and Repost wrapper URLs as not found", async () => {
    const backend = newBackend();
    await expect(
      backend.query(api.posts.getConversation, { postId: "not-an-id" }),
    ).resolves.toEqual({ _tag: "post-not-found" });

    const memberId = await registerMember(backend, aliceIdentity);
    const sourcePostId = await publish(backend, aliceIdentity, "Source");
    const repostId = await backend.run(async (ctx) =>
      ctx.db.insert("posts", {
        state: "active",
        kind: "repost",
        authorId: memberId,
        sourcePostId,
      }),
    );
    await expect(
      backend.query(api.posts.getConversation, { postId: repostId }),
    ).resolves.toEqual({ _tag: "post-not-found" });
  });
});

describe("Reply lifecycle across public Posts operations", () => {
  test("excludes Replies from Feed, includes them on Profiles, and supports Like and tombstone deletion", async () => {
    const backend = newBackend();
    const rootPostId = await publish(backend, aliceIdentity, "Feed root");
    const replyPostId = await publishReply(
      backend,
      benIdentity,
      rootPostId,
      "Profile Reply",
    );
    const benMemberId = await registerMember(backend, benIdentity);

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts.map((post) => post.postId)).toEqual([rootPostId]);

    const profile = await backend.query(api.posts.listByMember, {
      memberId: benMemberId,
    });
    expect(profile).toMatchObject({
      _tag: "ok",
      posts: [
        {
          postId: replyPostId,
          kind: "reply",
          replyingTo: {
            _tag: "active",
            postId: rootPostId,
            author: { displayName: "Alice Reader" },
          },
        },
      ],
    });

    await expect(
      (await asMember(backend, aliceIdentity)).mutation(api.posts.toggleLike, {
        postId: replyPostId,
      }),
    ).resolves.toEqual({ _tag: "ok", state: "liked", likeCount: 1 });
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.remove, { postId: replyPostId });

    const deletedProfile = await backend.query(api.posts.listByMember, {
      memberId: benMemberId,
    });
    expect(deletedProfile).toEqual({
      _tag: "ok",
      posts: [],
      ending: "complete",
    });
    await expect(
      (await asMember(backend, aliceIdentity)).mutation(api.posts.toggleLike, {
        postId: replyPostId,
      }),
    ).resolves.toEqual({ _tag: "post-unavailable" });

    const conversation = await backend.query(api.posts.getConversation, {
      postId: replyPostId,
    });
    expect(conversation).toMatchObject({
      _tag: "ok",
      replies: [
        {
          _tag: "tombstone",
          post: { postId: replyPostId, kind: "reply" },
        },
      ],
    });
    const remainingLikes = await backend.run(async (ctx) =>
      ctx.db.query("likes").collect(),
    );
    expect(remainingLikes).toEqual([]);
  });

  test("strips a deleted root while preserving surviving Replies and its stable URL", async () => {
    const backend = newBackend();
    const rootPostId = await publish(
      backend,
      aliceIdentity,
      "Identity and content must disappear.",
    );
    const replyPostId = await publishReply(
      backend,
      benIdentity,
      rootPostId,
      "A surviving Reply.",
    );

    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: rootPostId });

    const conversation = await backend.query(api.posts.getConversation, {
      postId: rootPostId,
    });
    expect(conversation).toMatchObject({
      _tag: "ok",
      root: {
        _tag: "tombstone",
        post: { postId: rootPostId, kind: "standalone" },
      },
      replies: [
        {
          _tag: "active",
          post: {
            postId: replyPostId,
            replyingTo: { _tag: "tombstone", postId: rootPostId },
          },
        },
      ],
    });
    expect(JSON.stringify(conversation)).not.toContain("Alice Reader");
    expect(JSON.stringify(conversation)).not.toContain(
      "Identity and content must disappear.",
    );
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

    expect(standalonePosts(feed.posts).map((post) => post.content)).toEqual([
      "Third",
      "Second",
      "First",
    ]);
    expect(feed.ending).toBe("complete");
    expect(
      standalonePosts(feed.posts).every(
        (post) => !post.viewerHasLiked && !post.viewerCanDelete,
      ),
    ).toBe(true);
  });

  test("selects eligible Standalone Posts before applying the Feed limit", async () => {
    const backend = newBackend();
    const memberId = await registerMember(backend, aliceIdentity);
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
    const memberId = await registerMember(backend, aliceIdentity);

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

  test("rejects Posts whose final persistence shape omits a kind", async () => {
    const backend = newBackend();
    const memberId = await registerMember(backend, aliceIdentity);

    // SAFETY: This test intentionally bypasses the generated insert type to
    // prove the contracted runtime schema rejects the former legacy shape.
    const missingKindPost = {
      authorId: memberId,
      content: "The compatibility window is closed.",
      likeCount: 0,
    } as unknown as WithoutSystemFields<DataModel["posts"]["document"]>;

    await expect(
      backend.run(async (ctx) => ctx.db.insert("posts", missingKindPost)),
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
    expect(standalonePosts(feed.posts)[0]?.content).toBe("Post 51");
    expect(standalonePosts(feed.posts)[49]?.content).toBe("Post 2");
  });
});

describe("Posts.toggleLike", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "A thought.");

    const outcome = await backend.mutation(api.posts.toggleLike, { postId });

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("reports a Post Tombstone as unavailable", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Ephemeral.");
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId });

    const outcome = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId });

    expect(outcome).toEqual({ _tag: "post-unavailable" });
  });

  test("creates and removes a Like with a consistent count", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Like me once.");
    const asBen = await asMember(backend, benIdentity);

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
    const asBen = await asMember(backend, benIdentity);

    await asBen.mutation(api.posts.toggleLike, { postId });
    await asBen.mutation(api.posts.toggleLike, { postId });
    await asBen.mutation(api.posts.toggleLike, { postId });

    const likes = await backend.run(async (ctx) => {
      return await ctx.db.query("likes").collect();
    });
    expect(likes).toHaveLength(1);

    const feed = await backend.query(api.posts.listFeed, {});
    expect(standalonePosts(feed.posts)[0]?.likeCount).toBe(1);
  });

  test("counts Likes from independent Members separately", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Widely liked.");

    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleLike, { postId });
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId });

    const asAliceFeed = await (
      await asMember(backend, aliceIdentity)
    ).query(api.posts.listFeed, {});
    expect(asAliceFeed.posts[0]).toMatchObject({
      likeCount: 2,
      viewerHasLiked: true,
    });

    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId });

    const afterBenUnliked = await (
      await asMember(backend, aliceIdentity)
    ).query(api.posts.listFeed, {});
    expect(afterBenUnliked.posts[0]).toMatchObject({
      likeCount: 1,
      viewerHasLiked: true,
    });
  });
});

describe("Posts.toggleRepost", () => {
  test("returns unauthenticated for a signed-out caller", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Worth sharing.");

    const outcome = await backend.mutation(api.posts.toggleRepost, { postId });

    expect(outcome).toEqual({ _tag: "unauthenticated" });
  });

  test("creates and reverses a self-Repost with one source count", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Share my thought.");
    const asAlice = await asMember(backend, aliceIdentity);

    const created = await asAlice.mutation(api.posts.toggleRepost, { postId });
    expect(created).toEqual({
      _tag: "ok",
      state: "reposted",
      activeRepostCount: 1,
    });

    const repostedFeed = await asAlice.query(api.posts.listFeed, {});
    expect(repostedFeed.posts).toHaveLength(2);
    expect(repostedFeed.posts[0]).toMatchObject({
      kind: "repost",
      author: { displayName: "Alice Reader" },
      source: {
        postId,
        kind: "standalone",
        content: "Share my thought.",
        activeRepostCount: 1,
        viewerHasReposted: true,
        author: { displayName: "Alice Reader" },
      },
    });
    expect(repostedFeed.posts[1]).toMatchObject({
      postId,
      kind: "standalone",
      activeRepostCount: 1,
      viewerHasReposted: true,
    });

    const removed = await asAlice.mutation(api.posts.toggleRepost, { postId });
    expect(removed).toEqual({
      _tag: "ok",
      state: "not-reposted",
      activeRepostCount: 0,
    });

    const restoredFeed = await asAlice.query(api.posts.listFeed, {});
    expect(restoredFeed.posts).toHaveLength(1);
    expect(restoredFeed.posts[0]).toMatchObject({
      postId,
      activeRepostCount: 0,
      viewerHasReposted: false,
    });
  });

  test("normalizes Repost and Like actions through a selected Repost", async () => {
    const backend = newBackend();
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "One identity for every action.",
    );
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });
    const feed = await backend.query(api.posts.listFeed, {});
    const wrapper = feed.posts.find((post) => post.kind === "repost");
    expect(wrapper).toBeDefined();
    if (wrapper === undefined) {
      return;
    }

    const reposted = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleRepost, { postId: wrapper.postId });
    expect(reposted).toEqual({
      _tag: "ok",
      state: "reposted",
      activeRepostCount: 2,
    });

    const liked = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId: wrapper.postId });
    expect(liked).toEqual({ _tag: "ok", state: "liked", likeCount: 1 });

    const asBen = await (
      await asMember(backend, benIdentity)
    ).query(api.posts.listFeed, {});
    const source = asBen.posts.find((post) => post.postId === sourcePostId);
    expect(source).toMatchObject({
      kind: "standalone",
      activeRepostCount: 2,
      likeCount: 1,
      viewerHasLiked: true,
      viewerHasReposted: true,
    });
    const wrappers = await backend.run(async (ctx) =>
      ctx.db
        .query("posts")
        .withIndex("by_sourcePostId_and_authorId", (q) =>
          q.eq("sourcePostId", sourcePostId),
        )
        .collect(),
    );
    expect(wrappers).toHaveLength(2);
    expect(
      wrappers.every(
        (post) => post.kind === "repost" && post.sourcePostId === sourcePostId,
      ),
    ).toBe(true);
  });

  test("reports a selected Post Tombstone without creating a wrapper", async () => {
    const backend = newBackend();
    const postId = await publish(
      backend,
      aliceIdentity,
      "Gone before sharing.",
    );
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId });

    const outcome = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleRepost, { postId });

    expect(outcome).toEqual({ _tag: "post-unavailable" });
  });

  test("serializes concurrent toggles without duplicate wrappers or counts", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Share exactly once.");
    const asBen = await asMember(backend, benIdentity);

    await Promise.all([
      asBen.mutation(api.posts.toggleRepost, { postId }),
      asBen.mutation(api.posts.toggleRepost, { postId }),
      asBen.mutation(api.posts.toggleRepost, { postId }),
    ]);

    const wrappers = await backend.run(async (ctx) =>
      ctx.db
        .query("posts")
        .withIndex("by_sourcePostId_and_authorId", (q) =>
          q.eq("sourcePostId", postId),
        )
        .collect(),
    );
    expect(wrappers).toHaveLength(1);
    const feed = await asBen.query(api.posts.listFeed, {});
    const source = feed.posts.find((post) => post.postId === postId);
    expect(source).toMatchObject({
      kind: "standalone",
      activeRepostCount: 1,
      viewerHasReposted: true,
    });
  });

  test("exposes reposter and source attribution in public Feed and Profile reads", async () => {
    const backend = newBackend();
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "The source keeps its author.",
    );
    const benMemberId = await registerMember(backend, benIdentity);
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });

    const feed = await backend.query(api.posts.listFeed, {});
    const repost = feed.posts.find((post) => post.kind === "repost");
    expect(repost).toMatchObject({
      kind: "repost",
      author: { displayName: "Ben Quiet", memberId: benMemberId },
      viewerCanRemove: false,
      source: {
        postId: sourcePostId,
        content: "The source keeps its author.",
        viewerHasReposted: false,
        author: { displayName: "Alice Reader" },
      },
    });
    if (repost === undefined || repost.kind !== "repost") {
      return;
    }
    expect(repost.publishedAt).toBeGreaterThanOrEqual(
      repost.source.publishedAt,
    );

    const profile = await backend.query(api.posts.listByMember, {
      memberId: benMemberId,
    });
    expect(profile).toMatchObject({
      _tag: "ok",
      posts: [
        expect.objectContaining({
          kind: "repost",
          author: expect.objectContaining({ memberId: benMemberId }),
          source: expect.objectContaining({ postId: sourcePostId }),
        }),
      ],
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

    const outcome = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.remove, { postId });

    expect(outcome).toEqual({ _tag: "forbidden" });
    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts).toHaveLength(1);
  });

  test("reports a missing Post", async () => {
    const backend = newBackend();
    const postId = await publish(backend, aliceIdentity, "Gone soon.");
    const asAlice = await asMember(backend, aliceIdentity);

    await asAlice.mutation(api.posts.remove, { postId });
    const outcome = await asAlice.mutation(api.posts.remove, { postId });

    expect(outcome).toEqual({ _tag: "post-not-found" });
  });

  test("lets the author delete and cascades associated Likes", async () => {
    const backend = newBackend();
    const removedId = await publish(backend, aliceIdentity, "Delete me.");
    const keptId = await publish(backend, benIdentity, "Keep me.");

    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleLike, { postId: removedId });
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId: removedId });
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleLike, { postId: keptId });

    const outcome = await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: removedId });
    expect(outcome).toEqual({ _tag: "ok" });

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts.map((post) => post.postId)).toEqual([keptId]);

    const remainingLikes = await backend.run(async (ctx) => {
      return await ctx.db.query("likes").collect();
    });
    expect(remainingLikes).toHaveLength(1);
    expect(remainingLikes[0]?.postId).toBe(keptId);
  });

  test("deleting a source removes every Repost wrapper", async () => {
    const backend = newBackend();
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "Delete the source everywhere.",
    );
    await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });

    const outcome = await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: sourcePostId });
    expect(outcome).toEqual({ _tag: "ok" });

    const feed = await backend.query(api.posts.listFeed, {});
    expect(feed.posts).toEqual([]);
    const remainingWrappers = await backend.run(async (ctx) =>
      ctx.db
        .query("posts")
        .withIndex("by_sourcePostId_and_authorId", (q) =>
          q.eq("sourcePostId", sourcePostId),
        )
        .collect(),
    );
    expect(remainingWrappers).toEqual([]);
  });

  test("only the reposter may remove a wrapper and removal decrements its source", async () => {
    const backend = newBackend();
    const sourcePostId = await publish(
      backend,
      aliceIdentity,
      "Ben controls Ben's distribution.",
    );
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleRepost, { postId: sourcePostId });
    const feed = await backend.query(api.posts.listFeed, {});
    const wrapper = feed.posts.find((post) => post.kind === "repost");
    expect(wrapper).toBeDefined();
    if (wrapper === undefined) {
      return;
    }

    const forbidden = await (
      await asMember(backend, aliceIdentity)
    ).mutation(api.posts.remove, { postId: wrapper.postId });
    expect(forbidden).toEqual({ _tag: "forbidden" });

    const removed = await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.remove, { postId: wrapper.postId });
    expect(removed).toEqual({ _tag: "ok" });
    const restoredFeed = await backend.query(api.posts.listFeed, {});
    expect(restoredFeed.posts).toEqual([
      expect.objectContaining({
        postId: sourcePostId,
        kind: "standalone",
        activeRepostCount: 0,
      }),
    ]);
  });

  test("refuses to mask a corrupted direct Reply count", async () => {
    const backend = newBackend();
    const rootPostId = await publish(
      backend,
      aliceIdentity,
      "A parent whose count must stay truthful.",
    );
    const asBen = await asMember(backend, benIdentity);
    const created = await asBen.mutation(api.posts.createReply, {
      parentPostId: rootPostId,
      content: "A direct Reply.",
    });
    expect(created._tag).toBe("ok");
    if (created._tag !== "ok") {
      return;
    }

    await backend.run(async (ctx) => {
      await ctx.db.patch("posts", rootPostId, { activeReplyCount: 0 });
    });

    await expect(
      asBen.mutation(api.posts.remove, { postId: created.postId }),
    ).rejects.toThrow("Reply parent count cannot fall below zero");
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
    expect(standalonePosts(outcome.posts).map((post) => post.content)).toEqual([
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
    await (
      await asMember(backend, benIdentity)
    ).mutation(api.posts.toggleLike, { postId });

    const feed = await backend.query(api.posts.listFeed, {});
    const aliceMemberId = feed.posts[0]?.author.memberId;
    expect(aliceMemberId).toBeDefined();
    if (aliceMemberId === undefined) {
      return;
    }

    const asBen = await (
      await asMember(backend, benIdentity)
    ).query(api.posts.listByMember, { memberId: aliceMemberId });

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
