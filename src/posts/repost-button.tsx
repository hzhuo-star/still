"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { AuthoredPostView, PostView } from "../../convex/contract/post";
import { casesHandled } from "../../convex/lib/result";
import { useOnboardingNavigation } from "@/members/registration";

type RepostButtonProps = {
  /** The ultimate source whose Repost state this control toggles. */
  readonly post: AuthoredPostView;
};

const buttonClassName =
  "flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-1 bg-transparent p-0 text-sm transition-colors ease-still focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default";

function describeReposts(post: AuthoredPostView): string {
  return `${post.activeRepostCount} ${post.activeRepostCount === 1 ? "repost" : "reposts"}`;
}

function updateSource(
  source: AuthoredPostView,
  sourcePostId: AuthoredPostView["postId"],
): AuthoredPostView {
  return source.postId === sourcePostId
    ? {
        ...source,
        viewerHasReposted: !source.viewerHasReposted,
        activeRepostCount:
          source.activeRepostCount + (source.viewerHasReposted ? -1 : 1),
      }
    : source;
}

function updatePost(
  post: PostView,
  sourcePostId: AuthoredPostView["postId"],
): PostView | null {
  if (post.kind !== "repost") {
    return updateSource(post, sourcePostId);
  }

  if (
    post.source.postId === sourcePostId &&
    post.source.viewerHasReposted &&
    post.viewerCanRemove
  ) {
    return null;
  }

  return { ...post, source: updateSource(post.source, sourcePostId) };
}

function updatePosts(
  posts: ReadonlyArray<PostView>,
  sourcePostId: AuthoredPostView["postId"],
): Array<PostView> {
  return posts.flatMap((post) => {
    const updated = updatePost(post, sourcePostId);
    return updated === null ? [] : [updated];
  });
}

/**
 * Toggles the viewer's unique Repost of an ultimate source with optimistic
 * state/count updates and automatic Convex rollback on failure.
 */
export function RepostButton({ post }: RepostButtonProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const onboarding = useOnboardingNavigation();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const toggleRepost = useMutation(api.posts.toggleRepost).withOptimisticUpdate(
    (localStore, args) => {
      const feed = localStore.getQuery(api.posts.listFeed, {});
      if (feed !== undefined) {
        localStore.setQuery(
          api.posts.listFeed,
          {},
          {
            ...feed,
            posts: updatePosts(feed.posts, args.postId),
          },
        );
      }

      for (const entry of localStore.getAllQueries(api.posts.listByMember)) {
        if (entry.value !== undefined && entry.value._tag === "ok") {
          localStore.setQuery(api.posts.listByMember, entry.args, {
            ...entry.value,
            posts: updatePosts(entry.value.posts, args.postId),
          });
        }
      }

      for (const entry of localStore.getAllQueries(api.posts.getConversation)) {
        if (entry.value !== undefined && entry.value._tag === "ok") {
          const updateEntry = (
            item: (typeof entry.value.replies)[number],
          ): (typeof entry.value.replies)[number] =>
            item._tag === "active"
              ? { ...item, post: updateSource(item.post, args.postId) }
              : item;

          localStore.setQuery(api.posts.getConversation, entry.args, {
            ...entry.value,
            root: updateEntry(entry.value.root),
            replies: entry.value.replies.map(updateEntry),
          });
        }
      }
    },
  );
  const label = post.viewerHasReposted ? "Reposted" : "Repost";
  const visibleText = `${label} · ${post.activeRepostCount}`;

  if (isLoading) {
    return (
      <button
        aria-label={`${label}, ${describeReposts(post)}`}
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
          aria-label={`${describeReposts(post)}. Sign in to Repost.`}
          className={`${buttonClassName} text-muted hover:text-sage`}
          type="button"
        >
          {visibleText}
        </button>
      </SignInButton>
    );
  }

  const onToggle = async () => {
    setPending(true);
    setFeedback(null);

    try {
      const outcome = await toggleRepost({ postId: post.postId });

      switch (outcome._tag) {
        case "ok":
          return;
        case "unauthenticated":
          setFeedback("Your session ended. Sign in again to Repost.");
          return;
        case "registration-required":
          onboarding.start();
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
      setFeedback("Your Repost didn’t reach Still. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        aria-label={`${label}, ${describeReposts(post)}`}
        aria-pressed={post.viewerHasReposted}
        className={`${buttonClassName} ${
          post.viewerHasReposted
            ? "font-medium text-sage"
            : "text-muted hover:text-sage"
        }`}
        disabled={pending}
        onClick={() => {
          void onToggle();
        }}
        type="button"
      >
        {pending ? "Updating Repost…" : visibleText}
      </button>
      {feedback === null ? null : (
        <p className="basis-full text-meta text-danger" role="alert">
          {feedback}
        </p>
      )}
    </>
  );
}
