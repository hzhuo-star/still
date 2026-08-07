/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SEARCH_LIMIT } from "../contract/search";
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
  profile?: { readonly displayName?: string; readonly biography?: string },
): Promise<Id<"members">> {
  const outcome = await backend
    .withIdentity(identity)
    .mutation(api.members.registerCurrent, {
      handle: identity.subject,
      displayName: profile?.displayName ?? identity.name ?? "Member",
      biography: profile?.biography ?? "",
    });

  if (outcome._tag === "ok") {
    return outcome.profile.memberId;
  }
  if (outcome._tag === "already-registered") {
    return outcome.memberId;
  }

  throw new Error(`Expected a registered Member, got ${outcome._tag}`);
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

async function searchPostIds(
  backend: TestConvex<typeof schema>,
  searchQuery: string,
): Promise<ReadonlyArray<Id<"posts">>> {
  const outcome = await backend.query(api.search.posts, {
    query: searchQuery,
  });

  if (outcome._tag !== "ok") {
    throw new Error(`Expected Post results, got ${outcome._tag}`);
  }

  return outcome.posts.map((post) => post.postId);
}

async function searchMemberIds(
  backend: TestConvex<typeof schema>,
  searchQuery: string,
): Promise<ReadonlyArray<Id<"members">>> {
  const outcome = await backend.query(api.search.members, {
    query: searchQuery,
  });

  if (outcome._tag !== "ok") {
    throw new Error(`Expected Member results, got ${outcome._tag}`);
  }

  return outcome.members.map((member) => member.memberId);
}

describe("Search.posts", () => {
  test("presents the explicit initial state for a blank query", async () => {
    const backend = newBackend();

    await expect(
      backend.query(api.search.posts, { query: "" }),
    ).resolves.toEqual({ _tag: "empty-query" });
    await expect(
      backend.query(api.search.posts, { query: "   " }),
    ).resolves.toEqual({ _tag: "empty-query" });
  });

  test("matches every text-bearing kind publicly and never a Repost wrapper", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);
    await register(backend, benIdentity);

    const standaloneId = await publish(
      backend,
      aliceIdentity,
      "A quiet lighthouse evening",
    );
    const replyOutcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.createReply, {
        parentPostId: standaloneId,
        content: "The lighthouse keeper replies",
      });
    if (replyOutcome._tag !== "ok") {
      throw new Error(`Expected a Reply, got ${replyOutcome._tag}`);
    }
    const quoteOutcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.createQuote, {
        targetPostId: standaloneId,
        commentary: "Quoting the lighthouse",
      });
    if (quoteOutcome._tag !== "ok") {
      throw new Error(`Expected a Quote, got ${quoteOutcome._tag}`);
    }
    const repostOutcome = await backend
      .withIdentity(benIdentity)
      .mutation(api.posts.toggleRepost, { postId: standaloneId });
    expect(repostOutcome).toMatchObject({ _tag: "ok", state: "reposted" });

    // The unauthenticated read returns all three text-bearing kinds; the
    // Repost wrapper has no text of its own and cannot appear.
    const results = await searchPostIds(backend, "lighthouse");

    expect([...results].sort()).toEqual(
      [standaloneId, replyOutcome.postId, quoteOutcome.postId].sort(),
    );
  });

  test("follows edits and deletions reactively under stable ids", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);

    const postId = await publish(backend, aliceIdentity, "Original wording");
    const before = await backend.query(api.search.posts, {
      query: "wording",
    });
    if (before._tag !== "ok") {
      throw new Error(`Expected Post results, got ${before._tag}`);
    }
    const publishedAt = before.posts[0]?.publishedAt;

    const edited = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.edit, {
        postId,
        expectedRevision: 0,
        content: "Replacement sentence entirely",
      });
    expect(edited).toMatchObject({ _tag: "ok", revision: 1 });

    // The old text no longer matches; the new text matches the same stable
    // Post without treating it as newly published.
    await expect(searchPostIds(backend, "wording")).resolves.toEqual([]);
    const after = await backend.query(api.search.posts, {
      query: "replacement",
    });
    expect(after).toMatchObject({
      _tag: "ok",
      posts: [{ postId, publishedAt, revision: 1 }],
    });

    const removed = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.remove, { postId });
    expect(removed).toEqual({ _tag: "ok" });
    await expect(searchPostIds(backend, "replacement")).resolves.toEqual([]);
  });

  test("carries viewer state and bounds 21 candidates to 20 results", async () => {
    const backend = newBackend();
    await register(backend, aliceIdentity);

    const likedId = await publish(
      backend,
      aliceIdentity,
      "Countable thought 0",
    );
    const liked = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.posts.toggleLike, { postId: likedId });
    expect(liked).toMatchObject({ _tag: "ok", state: "liked" });

    for (let index = 1; index < SEARCH_LIMIT + 1; index += 1) {
      await publish(backend, aliceIdentity, `Countable thought ${index}`);
    }

    const bounded = await backend
      .withIdentity(aliceIdentity)
      .query(api.search.posts, { query: "countable" });

    expect(bounded).toMatchObject({ _tag: "ok", ending: "truncated" });
    if (bounded._tag !== "ok") {
      return;
    }
    expect(bounded.posts).toHaveLength(SEARCH_LIMIT);
    const likedView = bounded.posts.find((post) => post.postId === likedId);
    if (likedView === undefined) {
      throw new Error("Expected the Liked Post inside the bounded results");
    }
    expect(likedView).toMatchObject({ viewerHasLiked: true });

    const complete = await backend.query(api.search.posts, {
      query: "thought 3",
    });
    expect(complete).toMatchObject({ _tag: "ok" });
  });
});

describe("Search.members", () => {
  test("presents the explicit initial state for a blank query", async () => {
    const backend = newBackend();

    await expect(
      backend.query(api.search.members, { query: "  " }),
    ).resolves.toEqual({ _tag: "empty-query" });
  });

  test("matches Handle and display name but never biography text", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity, {
      biography: "Collects rare seashells",
    });
    await register(backend, benIdentity);

    await expect(searchMemberIds(backend, "Alice")).resolves.toEqual([aliceId]);
    await expect(searchMemberIds(backend, "user_alice")).resolves.toEqual([
      aliceId,
    ]);
    await expect(searchMemberIds(backend, "seashells")).resolves.toEqual([]);
  });

  test("places a case-insensitive exact Handle owner first without duplication", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity, {
      displayName: "user_ben admirer",
    });
    const benId = await register(backend, benIdentity);

    // Alice's display name also matches the query, so Ben must lead the
    // results as the exact owner and appear exactly once.
    const results = await searchMemberIds(backend, "USER_BEN");

    expect(results[0]).toBe(benId);
    expect(results.filter((memberId) => memberId === benId)).toHaveLength(1);
    expect(results).toContain(aliceId);
  });

  test("follows Profile edits and immediate Handle reuse with one owner", async () => {
    const backend = newBackend();
    const aliceId = await register(backend, aliceIdentity);
    const claraId = await register(backend, claraIdentity);

    const renamed = await backend
      .withIdentity(aliceIdentity)
      .mutation(api.members.updateCurrent, {
        handle: "quiet_reader",
        displayName: "Quiet Reader",
        biography: "",
      });
    expect(renamed).toMatchObject({ _tag: "ok" });

    // The released Handle is immediately claimed by another Member; exact
    // lookup must return only the new owner, never both.
    const reclaimed = await backend
      .withIdentity(claraIdentity)
      .mutation(api.members.updateCurrent, {
        handle: "user_alice",
        displayName: "Clara Note",
        biography: "",
      });
    expect(reclaimed).toMatchObject({ _tag: "ok" });

    await expect(searchMemberIds(backend, "user_alice")).resolves.toEqual([
      claraId,
    ]);
    await expect(searchMemberIds(backend, "quiet_reader")).resolves.toEqual([
      aliceId,
    ]);
    await expect(searchMemberIds(backend, "Quiet Reader")).resolves.toEqual([
      aliceId,
    ]);
  });

  test("bounds Member results to 20 with honest truncation", async () => {
    const backend = newBackend();

    for (let index = 0; index < SEARCH_LIMIT + 1; index += 1) {
      await register(
        backend,
        { subject: `walker_${index}` },
        { displayName: `Wandering Walker ${index}` },
      );
    }

    const outcome = await backend.query(api.search.members, {
      query: "wandering",
    });

    expect(outcome).toMatchObject({ _tag: "ok", ending: "truncated" });
    if (outcome._tag !== "ok") {
      return;
    }
    expect(outcome.members).toHaveLength(SEARCH_LIMIT);
  });
});
