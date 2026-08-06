"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import Link from "next/link";

import type { Id } from "../../convex/_generated/dataModel";
import { useReplyNavigation } from "@/posts/reply-composer";

type ReplyActionProps = {
  /** The active authored Post that should receive the Reply. */
  readonly postId: Id<"posts">;
  /** The active direct Reply count displayed beside the action. */
  readonly activeReplyCount: number;
};

const controlClassName =
  "flex min-h-touch items-center bg-transparent p-0 text-sm text-muted no-underline transition-colors ease-still hover:text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function describeReplyCount(count: number): string {
  return `${count} ${count === 1 ? "reply" : "replies"}`;
}

/**
 * Opens the selected Post's Conversation composer for Members and requests
 * sign-in before navigation for visitors.
 */
export function ReplyAction({ postId, activeReplyCount }: ReplyActionProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigation = useReplyNavigation();
  const label = `Reply · ${activeReplyCount}`;

  if (isLoading) {
    return (
      <button className={controlClassName} disabled type="button">
        {label}
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInButton>
        <button
          aria-label={`${describeReplyCount(activeReplyCount)}. Sign in to Reply.`}
          className={controlClassName}
          type="button"
        >
          {label}
        </button>
      </SignInButton>
    );
  }

  return (
    <Link
      aria-label={`Reply to this Post. ${describeReplyCount(activeReplyCount)}.`}
      className={controlClassName}
      href={`/posts/${postId}?compose=reply`}
      onClick={() => {
        if (navigation?.postId === postId) {
          navigation.requestOpen();
        }
      }}
    >
      {label}
    </Link>
  );
}
