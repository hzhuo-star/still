/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { FEED_LIMIT, type PostView } from "../contract/post";
import { byNewestFirst } from "../lib/postOrder";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function newBackend(): TestConvex<typeof schema> {
  return convexTest(schema, modules);
}

type TestIdentity = {
  readonly subject: string;
  readonly name?: string;
};

const aliceIdentity = { subject: "user_alice", name: "Alice Reader" } as const;
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

async function publish(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
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

async function repost(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
  postId: Id<"posts">,
): Promise<void> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.posts.toggleRepost, { postId });

  if (outcome._tag !== "ok" || outcome.state !== "reposted") {
    throw new Error(`Expected a Repost, got ${outcome._tag}`);
  }
}

async function feedFor(
  backend: TestConvex<typeof schema>,
  identity: TestIdentity,
): Promise<{
  readonly posts: ReadonlyArray<PostView>;
  readonly ending: "complete" | "truncated";
}> {
  const outcome = await backend
    .withIdentity(identity)
    .query(api.posts.listFollowingFeed, {});

  if (outcome._tag !== "ok") {
    throw new Error(`Expected a Following Feed, got ${outcome._tag}`);
  }

  return { posts: outcome.posts, ending: outcome.ending };
}

describe("Posts.listFollowingFeed", () => {
  test("refuses signed-out and unregistered viewers precisely", async () => {
    const backend = newBackend();

    await expect(
      backend.query(api.posts.listFollowingFeed, {}),
    ).resolves.toEqual({ _tag: "unauthenticated" });

    const awaiting = backend.withIdentity(claraIdentity);
    await awaiting.mutation(api.members.ensureCurrent, {});
    await expect(
      awaiting.query(api.posts.listFollowingFeed, {}),
    ).resolves.toEqual({ _tag: "registration-required" });
  });

  test("includes the viewer's own eligible Posts even with zero follows", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);

    const standaloneId = await publish(backend, aliceIdentity, "Own thought");
    const replyOutcome = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.createReply, {
        parentPostId: standaloneId,
        content: "Own reply",
      });
    if (replyOutcome._tag !== "ok") {
      throw new Error(`Expected a Reply, got ${replyOutcome._tag}`);
    }
    const quoteOutcome = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.createQuote, {
        targetPostId: standaloneId,
        commentary: "Quoting myself",
      });
    if (quoteOutcome._tag !== "ok") {
      throw new Error(`Expected a Quote, got ${quoteOutcome._tag}`);
    }

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.ending).toBe("complete");
    expect(feed.posts.map((post) => post.postId)).toEqual([
      quoteOutcome.postId,
      standaloneId,
    ]);
  });

  test("includes followed Members' eligible Posts and excludes everyone else's", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await register(backend, claraIdentity);
    await follow(backend, aliceIdentity, benId);

    const benPostId = await publish(backend, benIdentity, "Ben in the Feed");
    await publish(backend, claraIdentity, "Clara outside the Feed");
    const benReplyOutcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.createReply, {
        parentPostId: benPostId,
        content: "Ben's Reply stays out",
      });
    if (benReplyOutcome._tag !== "ok") {
      throw new Error(`Expected a Reply, got ${benReplyOutcome._tag}`);
    }

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.posts.map((post) => post.postId)).toEqual([benPostId]);
  });

  test("attributes a Repost to its reposter with normalized engagement", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    const claraId = await register(backend, claraIdentity);
    await follow(backend, aliceIdentity, benId);

    const claraPostId = await publish(backend, claraIdentity, "Clara's words");
    await repost(backend, benIdentity, claraPostId);

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0]).toMatchObject({
      kind: "repost",
      author: { memberId: benId },
      source: {
        postId: claraPostId,
        author: { memberId: claraId },
        activeRepostCount: 1,
      },
    });
    expect(aliceId).not.toBe(benId);
  });

  test("follows the Follow graph and Post lifecycle reactively", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await follow(backend, aliceIdentity, benId);

    const benPostId = await publish(backend, benIdentity, "Ben's thought");
    const benSecondId = await publish(backend, benIdentity, "Ben again");

    expect(
      (await feedFor(backend, aliceIdentity)).posts.map((post) => post.postId),
    ).toEqual([benSecondId, benPostId]);

    const removed = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.remove, { postId: benSecondId });
    expect(removed).toEqual({ _tag: "ok" });
    expect(
      (await feedFor(backend, aliceIdentity)).posts.map((post) => post.postId),
    ).toEqual([benPostId]);

    const unfollowed = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.setFollow, {
        memberId: benId,
        intent: "unfollow",
      });
    expect(unfollowed).toMatchObject({ _tag: "ok", state: "not-following" });
    expect((await feedFor(backend, aliceIdentity)).posts).toEqual([]);
  });

  test("keeps an edited Post in place with its Edited marker", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await follow(backend, aliceIdentity, benId);

    const firstId = await publish(backend, benIdentity, "Before the edit");
    const secondId = await publish(backend, benIdentity, "Stays newest");

    const edited = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.edit, {
        postId: firstId,
        expectedRevision: 0,
        content: "After the edit",
      });
    expect(edited).toMatchObject({ _tag: "ok", revision: 1 });

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.posts.map((post) => post.postId)).toEqual([secondId, firstId]);
    expect(feed.posts[1]).toMatchObject({
      content: "After the edit",
      revision: 1,
      editedAt: expect.any(Number),
    });
  });

  test("carries viewer-specific state on Following Feed entries", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await follow(backend, aliceIdentity, benId);

    const benPostId = await publish(backend, benIdentity, "Like me");
    const liked = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.toggleLike, { postId: benPostId });
    expect(liked).toMatchObject({ _tag: "ok", state: "liked" });

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.posts[0]).toMatchObject({
      postId: benPostId,
      viewerHasLiked: true,
      viewerCanEdit: false,
      viewerCanDelete: false,
    });
  });

  test("reacts to Repost removal and Quote-source availability changes", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await register(backend, claraIdentity);
    await follow(backend, aliceIdentity, benId);

    const claraPostId = await publish(backend, claraIdentity, "Clara's words");
    await repost(backend, benIdentity, claraPostId);
    expect((await feedFor(backend, aliceIdentity)).posts).toHaveLength(1);

    // Removing the Repost removes its Feed entry without touching the source.
    const unreposted = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleRepost, { postId: claraPostId });
    expect(unreposted).toMatchObject({ _tag: "ok", state: "not-reposted" });
    expect((await feedFor(backend, aliceIdentity)).posts).toEqual([]);

    const quoteOutcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.createQuote, {
        targetPostId: claraPostId,
        commentary: "Ben quotes Clara",
      });
    if (quoteOutcome._tag !== "ok") {
      throw new Error(`Expected a Quote, got ${quoteOutcome._tag}`);
    }
    expect((await feedFor(backend, aliceIdentity)).posts[0]).toMatchObject({
      kind: "quote",
      reference: { _tag: "available", post: { postId: claraPostId } },
    });

    // Deleting the source keeps the Quote in the Feed with an unavailable
    // reference instead of removing or breaking the entry.
    const removed = await backend
      .withIdentity(claraIdentity)
      .mutation(api.posts.remove, { postId: claraPostId });
    expect(removed).toEqual({ _tag: "ok" });
    expect((await feedFor(backend, aliceIdentity)).posts[0]).toMatchObject({
      kind: "quote",
      postId: quoteOutcome.postId,
      reference: { _tag: "unavailable" },
    });
  });

  test("orders equal publication times deterministically", () => {
    // convex-test always assigns strictly increasing creation times, so the
    // equal-time tie-break is proven on the pure comparator the merge uses.
    const posts = [
      { _creationTime: 5, _id: "b" },
      { _creationTime: 5, _id: "a" },
      { _creationTime: 7, _id: "c" },
    ];

    const sortedOneWay = [...posts].sort(byNewestFirst);
    const sortedOtherWay = [...posts].reverse().sort(byNewestFirst);

    expect(sortedOneWay).toEqual(sortedOtherWay);
    expect(sortedOneWay.map((post) => post._id)).toEqual(["c", "b", "a"]);
  });

  test("merges authors newest-first and bounds 51 results to 50", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    const benId = await register(backend, benIdentity);
    await follow(backend, aliceIdentity, benId);

    const published: Array<Id<"posts">> = [];
    for (let index = 0; index < FEED_LIMIT + 1; index += 1) {
      const author = index % 2 === 0 ? aliceIdentity : benIdentity;
      published.push(await publish(backend, author, `Thought ${index}`));
    }

    const feed = await feedFor(backend, aliceIdentity);

    expect(feed.ending).toBe("truncated");
    expect(feed.posts.map((post) => post.postId)).toEqual(
      [...published].reverse().slice(0, FEED_LIMIT),
    );
  });
});
