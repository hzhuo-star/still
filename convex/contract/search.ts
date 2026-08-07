import { v, type Infer } from "convex/values";

import { listEndingValidator } from "./list";
import { memberSummaryValidator } from "./member";
import { authoredPostViewValidator } from "./post";

/** The most results one Search tab renders; one extra candidate is read only
 * to distinguish a complete tab from a truncated one. */
export const SEARCH_LIMIT = 20;

/**
 * The outcome of searching current public Post text.
 *
 * `empty-query` is the explicit initial state a blank submission presents;
 * Search never substitutes trends or recommendations for a missing query.
 */
export const searchPostsOutcomeValidator = v.union(
  v.object({ _tag: v.literal("empty-query") }),
  v.object({
    _tag: v.literal("ok"),
    /** Matching active text-bearing Posts in Convex relevance order. */
    posts: v.array(authoredPostViewValidator),
    /** Whether more matches exist beyond the bounded results. */
    ending: listEndingValidator,
  }),
);

/** The outcome of searching current public Post text. */
export type SearchPostsOutcome = Readonly<
  Infer<typeof searchPostsOutcomeValidator>
>;

/**
 * The outcome of searching current Member Handles and display names.
 *
 * Biography text is never projected into the Search index, so it cannot
 * match. An exact Handle match leads the results and appears only once.
 */
export const searchMembersOutcomeValidator = v.union(
  v.object({ _tag: v.literal("empty-query") }),
  v.object({
    _tag: v.literal("ok"),
    /** Matching registered Members, an exact Handle match first. */
    members: v.array(memberSummaryValidator),
    /** Whether more matches exist beyond the bounded results. */
    ending: listEndingValidator,
  }),
);

/** The outcome of searching current Member Handles and display names. */
export type SearchMembersOutcome = Readonly<
  Infer<typeof searchMembersOutcomeValidator>
>;
