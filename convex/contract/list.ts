import { v, type Infer } from "convex/values";

/**
 * Whether a bounded public list contains every available item or only the
 * newest page of them.
 *
 * Every finite list in Still — Feeds, Conversations, relationship lists —
 * reports its ending the same way, so a reader is never left guessing whether
 * more exists.
 */
export const listEndingValidator = v.union(
  v.literal("complete"),
  v.literal("truncated"),
);

/** Whether a bounded public list is complete or truncated. */
export type ListEnding = Infer<typeof listEndingValidator>;
