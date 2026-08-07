import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  SEARCH_LIMIT,
  type SearchMembersOutcome,
  type SearchPostsOutcome,
} from "../contract/search";
import type { MemberSummary } from "../contract/member";
import * as MemberProfile from "../lib/memberProfile";
import {
  asRegistered,
  toMemberSummary,
  type RegisteredMemberRecord,
} from "./memberProjection";
import { currentMemberId } from "./members";
import { toAuthoredPostView } from "./posts";

/**
 * Search current active Post text as complete display models.
 *
 * Only active text-bearing Posts carry a `content` field, so Repost wrappers,
 * Post Tombstones, and pre-edit history can never match; an edit re-indexes
 * the Post under its stable id without treating it as newly published.
 * Results keep Convex relevance order, which breaks ties newest-first —
 * Search claims no custom ranking of its own.
 *
 * @param ctx - The Convex query context.
 * @param rawQuery - The raw, untrusted Search box text.
 * @returns The bounded matches, or the explicit empty-query initial state.
 */
export async function searchPosts(
  ctx: QueryCtx,
  rawQuery: string,
): Promise<SearchPostsOutcome> {
  const searchQuery = rawQuery.trim();

  if (searchQuery.length === 0) {
    return { _tag: "empty-query" };
  }

  const viewerId = await currentMemberId(ctx);
  const page = await ctx.db
    .query("posts")
    .withSearchIndex("search_content", (q) =>
      q.search("content", searchQuery).eq("state", "active"),
    )
    .take(SEARCH_LIMIT + 1);

  return {
    _tag: "ok",
    posts: await Promise.all(
      page
        .slice(0, SEARCH_LIMIT)
        .map(async (post) => await toAuthoredPostView(ctx, post, viewerId)),
    ),
    ending: page.length > SEARCH_LIMIT ? "truncated" : "complete",
  };
}

/**
 * Search current Member Handles and display names as public summaries.
 *
 * The query is folded through the same projection the index stores, so
 * matching is case-insensitive without any biography reach. When the query
 * parses as a Handle, its case-insensitive owner is resolved through the
 * authoritative ownership index and placed first — deduplicated from the
 * full-text matches — so an immediate Handle release and reuse can never
 * return two owners for one normalized Handle.
 *
 * When the bounded candidate page is full, `truncated` is reported even if a
 * pending Member among the candidates rendered nothing: the 21-candidate
 * bound cannot see past itself, and claiming completeness there could be
 * false, while "showing the first matches" never is. Deliberate.
 *
 * @param ctx - The Convex query context.
 * @param rawQuery - The raw, untrusted Search box text.
 * @returns The bounded matches, or the explicit empty-query initial state.
 */
export async function searchMembers(
  ctx: QueryCtx,
  rawQuery: string,
): Promise<SearchMembersOutcome> {
  const searchQuery = MemberProfile.searchProjection([rawQuery]);

  if (searchQuery.length === 0) {
    return { _tag: "empty-query" };
  }

  const exact = await exactHandleOwner(ctx, rawQuery);
  const page = await ctx.db
    .query("members")
    .withSearchIndex("search_searchText", (q) =>
      q.search("searchText", searchQuery),
    )
    .take(SEARCH_LIMIT + 1);

  const matches: Array<MemberSummary> =
    exact === null ? [] : [toMemberSummary(exact)];

  for (const member of page) {
    if (exact !== null && member._id === exact._id) {
      continue;
    }

    // A pending Member is indexed by display name but owns no Handle yet, so
    // there is no public summary to render for them.
    const registered = asRegistered(member);
    if (registered !== null) {
      matches.push(toMemberSummary(registered));
    }
  }

  return {
    _tag: "ok",
    members: matches.slice(0, SEARCH_LIMIT),
    ending:
      matches.length > SEARCH_LIMIT || page.length > SEARCH_LIMIT
        ? "truncated"
        : "complete",
  };
}

/** Resolve the registered owner of the query read as an exact Handle. */
async function exactHandleOwner(
  ctx: QueryCtx,
  rawQuery: string,
): Promise<RegisteredMemberRecord | null> {
  const claim = MemberProfile.parseHandle(rawQuery);

  if (claim._tag === "err") {
    return null;
  }

  const owner: Doc<"members"> | null = await ctx.db
    .query("members")
    .withIndex("by_normalizedHandle", (q) =>
      q.eq("normalizedHandle", claim.value.normalizedHandle),
    )
    .unique();

  return owner === null ? null : asRegistered(owner);
}
