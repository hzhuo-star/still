"use client";

import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";

import { api } from "../../convex/_generated/api";
import { casesHandled } from "../../convex/lib/result";
import { OnboardingInvite } from "@/members/onboarding-invite";
import { ListEndingNotice } from "@/posts/list-ending";
import { PostList } from "@/posts/post-list";
import { PostListSkeleton } from "@/posts/post-list-skeleton";

function SignedOutInvite() {
  return (
    <section className="rounded-card border border-line p-5">
      <h2 className="text-body font-medium text-ink">
        The Following Feed is yours alone.
      </h2>
      <p className="mt-1 text-meta text-muted">
        Sign in to see your own Posts beside the Members you Follow.
      </p>
      <SignInButton>
        <button
          className="mt-3 min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
          type="button"
        >
          Sign in
        </button>
      </SignInButton>
    </section>
  );
}

function EmptyFollowingFeed() {
  return (
    <>
      <section
        aria-labelledby="empty-following-feed"
        className="border-t border-line py-10"
      >
        <h2
          className="font-reading text-2xl text-ink"
          id="empty-following-feed"
        >
          Nothing here yet — and that’s fixable.
        </h2>
        <p className="mt-3 text-body text-muted">
          Your Following Feed holds your own Posts and Posts from Members you
          Follow. Publish a thought, or find Members worth following in the{" "}
          <Link
            className="text-sage underline-offset-2 hover:underline"
            href="/"
          >
            public Feed
          </Link>
          .
        </p>
      </section>
      <ListEndingNotice ending="complete" />
    </>
  );
}

/**
 * The viewer's exact reactive Following Feed: their own eligible Posts beside
 * those of the at most 50 Members they Follow, newest first. A signed-out or
 * still-onboarding visitor is routed to the missing step by the query's
 * precise refusal instead of being shown a misleading empty Feed.
 */
export function FollowingFeed() {
  const feed = useQuery(api.posts.listFollowingFeed, {});

  if (feed === undefined) {
    return <PostListSkeleton loadingLabel="Loading your Following Feed" />;
  }

  switch (feed._tag) {
    case "unauthenticated":
      return <SignedOutInvite />;
    case "registration-required":
      return <OnboardingInvite action="see your Following Feed" />;
    case "ok":
      return feed.posts.length === 0 ? (
        <EmptyFollowingFeed />
      ) : (
        <PostList ending={feed.ending} posts={feed.posts} />
      );
    default:
      return casesHandled(feed);
  }
}
