import type { Id } from "./_generated/dataModel";
import type { MemberProfile } from "./memberContract";

/** The maximum number of Posts a Feed or Profile renders. */
export const FEED_LIMIT = 50;

/** Whether a Post list contains every available Post or only the newest 50. */
export type ListEnding = "complete" | "truncated";

/** The complete immutable display model for one Post. */
export type PostView = {
  /** The Post's canonical identifier. */
  readonly postId: Id<"posts">;
  /** Parsed plain-text Post content with internal line breaks preserved. */
  readonly content: string;
  /** Server creation time in milliseconds since the Unix epoch. */
  readonly publishedAt: number;
  /** The Post's current Like count. */
  readonly likeCount: number;
  /** Whether the current viewer has Liked the Post. */
  readonly viewerHasLiked: boolean;
  /** Whether the current viewer may delete the Post. */
  readonly viewerCanDelete: boolean;
  /** The Post author's projected public identity. */
  readonly author: MemberProfile;
};

/** A bounded collection of complete Post display models. */
export type PostList = {
  /** The newest Posts selected for the Feed or Profile. */
  readonly posts: PostView[];
  /** Whether older Posts exist beyond the bounded collection. */
  readonly ending: ListEnding;
};

/** The outcome of reading one Member's bounded Post collection. */
export type ListByMemberOutcome =
  ({ readonly _tag: "ok" } & PostList) | { readonly _tag: "member-not-found" };

/** The outcome of publishing a Post. */
export type CreatePostOutcome =
  | { readonly _tag: "ok"; readonly postId: Id<"posts"> }
  | { readonly _tag: "unauthenticated" }
  | {
      readonly _tag: "invalid-content";
      readonly reason: "empty" | "too-long";
    };

/** The outcome of toggling the acting Member's Like on a Post. */
export type ToggleLikeOutcome =
  | {
      readonly _tag: "ok";
      readonly state: "liked" | "unliked";
      readonly likeCount: number;
    }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "post-not-found" };

/** The outcome of removing a Post. */
export type RemovePostOutcome =
  | { readonly _tag: "ok" }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "forbidden" }
  | { readonly _tag: "post-not-found" };
