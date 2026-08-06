"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { AuthoredPostView, PostView } from "../../convex/contract/post";
import { casesHandled } from "../../convex/lib/result";

type LikeButtonProps = {
  /** The Post whose Like state this control toggles. */
  readonly post: AuthoredPostView;
};

function describeLikes(post: AuthoredPostView): string {
  return `${post.likeCount} ${post.likeCount === 1 ? "like" : "likes"}`;
}

const buttonClassName =
  "flex min-h-touch cursor-pointer items-center gap-1 bg-transparent p-0 text-sm transition-colors ease-still focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Toggles the viewer's Like on a Post with optimistic state and count,
 * rolling back with inline feedback when the mutation fails. Signed-out
 * visitors see the count and a sign-in path.
 */
export function LikeButton({ post }: LikeButtonProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleLike = useMutation(api.posts.toggleLike).withOptimisticUpdate(
    (localStore, args) => {
      const flipSource = (view: AuthoredPostView): AuthoredPostView =>
        view.postId === args.postId
          ? {
              ...view,
              viewerHasLiked: !view.viewerHasLiked,
              likeCount: view.likeCount + (view.viewerHasLiked ? -1 : 1),
            }
          : view;
      const flip = (view: PostView): PostView =>
        view.kind === "repost"
          ? { ...view, source: flipSource(view.source) }
          : flipSource(view);

      const feed = localStore.getQuery(api.posts.listFeed, {});
      if (feed !== undefined) {
        localStore.setQuery(
          api.posts.listFeed,
          {},
          {
            ...feed,
            posts: feed.posts.map(flip),
          },
        );
      }

      for (const entry of localStore.getAllQueries(api.posts.listByMember)) {
        if (entry.value !== undefined && entry.value._tag === "ok") {
          localStore.setQuery(api.posts.listByMember, entry.args, {
            ...entry.value,
            posts: entry.value.posts.map(flip),
          });
        }
      }

      for (const entry of localStore.getAllQueries(api.posts.getConversation)) {
        if (entry.value !== undefined && entry.value._tag === "ok") {
          const flipEntry = (
            item: (typeof entry.value.replies)[number],
          ): (typeof entry.value.replies)[number] =>
            item._tag === "active"
              ? { ...item, post: flipSource(item.post) }
              : item;

          localStore.setQuery(api.posts.getConversation, entry.args, {
            ...entry.value,
            root: flipEntry(entry.value.root),
            replies: entry.value.replies.map(flipEntry),
          });
        }
      }
    },
  );

  const label = post.viewerHasLiked ? "Liked" : "Like";
  const visibleText = `${label} · ${post.likeCount}`;

  if (isLoading) {
    return (
      <button
        aria-label={`${label}, ${describeLikes(post)}`}
        className={`${buttonClassName} cursor-default text-muted`}
        disabled
        type="button"
      >
        {visibleText}
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInButton>
        <button
          aria-label={`${describeLikes(post)}. Sign in to Like Posts.`}
          className={`${buttonClassName} text-muted hover:text-sage`}
          type="button"
        >
          {visibleText}
        </button>
      </SignInButton>
    );
  }

  const onToggle = async () => {
    setFeedback(null);

    try {
      const outcome = await toggleLike({ postId: post.postId });

      switch (outcome._tag) {
        case "ok":
          return;
        case "unauthenticated":
          setFeedback("Your session ended. Sign in again to Like Posts.");
          return;
        case "post-not-found":
          setFeedback("This Post was deleted.");
          return;
        case "post-unavailable":
          setFeedback("This Post is no longer available.");
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setFeedback("Your Like didn’t reach Still. Try again.");
    }
  };

  return (
    <>
      <button
        aria-label={`${label}, ${describeLikes(post)}`}
        aria-pressed={post.viewerHasLiked}
        className={`${buttonClassName} ${
          post.viewerHasLiked
            ? "font-medium text-sage"
            : "text-muted hover:text-sage"
        }`}
        onClick={() => {
          void onToggle();
        }}
        type="button"
      >
        {visibleText}
      </button>
      {feedback === null ? null : (
        <p className="basis-full text-meta text-danger" role="alert">
          {feedback}
        </p>
      )}
    </>
  );
}
