"use client";

import Link from "next/link";

import type { PostView } from "../../convex/contract/post";
import { MemberAvatar } from "@/members/member-avatar";
import { DeleteButton } from "@/posts/delete-button";
import { LikeButton } from "@/posts/like-button";
import { ReplyAction } from "@/posts/reply-action";
import { describePublishedAt, formatPublishedAt } from "@/posts/post-time";
import { useNow } from "@/posts/use-now";

type PostCardProps = {
  /** The complete display model for the Post. */
  readonly post: PostView;
  /** Whether a stable Reply URL requested this exact Post. */
  readonly isRequested?: boolean;
};

/**
 * Renders one Post: author identity linking to the Member's Profile,
 * publication time, plain-text content with preserved line breaks, and the
 * quiet Like and Delete controls.
 */
export function PostCard({ post, isRequested = false }: PostCardProps) {
  const now = useNow();
  const profileHref = `/members/${post.author.memberId}`;

  return (
    <article
      aria-current={isRequested ? "true" : undefined}
      className={`border-t border-line py-post ${
        isRequested ? "-mx-3 rounded-card bg-sage-soft px-3" : ""
      }`}
    >
      {isRequested ? (
        <p className="mb-3 text-label font-semibold tracking-wider text-sage uppercase">
          Requested Reply
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Link aria-hidden="true" href={profileHref} tabIndex={-1}>
          <MemberAvatar
            avatarUrl={post.author.avatarUrl}
            displayName={post.author.displayName}
            sizePx={34}
          />
        </Link>
        <div className="min-w-0">
          <Link
            className="block truncate text-sm font-medium text-ink no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href={profileHref}
          >
            {post.author.displayName}
          </Link>
          <p className="text-meta text-muted">
            {post.kind === "reply" ? "Reply · " : ""}
            {post.kind === "quote" ? "Quote Post · " : ""}
            <time
              dateTime={new Date(post.publishedAt).toISOString()}
              title={describePublishedAt(post.publishedAt)}
            >
              {formatPublishedAt(post.publishedAt, now)}
            </time>
          </p>
        </div>
      </div>

      {post.kind === "reply" ? (
        <p className="mt-3 text-meta text-muted">
          {post.replyingTo._tag === "active"
            ? `Replying to ${post.replyingTo.author.displayName}`
            : "Replying to an unavailable Post"}
        </p>
      ) : null}

      <Link
        className="block text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={`/posts/${post.postId}`}
      >
        <p className="mt-3 font-reading text-reading whitespace-pre-wrap text-ink">
          {post.content}
        </p>
      </Link>

      <footer className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
        <ReplyAction
          activeReplyCount={post.activeReplyCount}
          postId={post.postId}
        />
        <LikeButton post={post} />
        {post.viewerCanDelete ? <DeleteButton postId={post.postId} /> : null}
      </footer>
    </article>
  );
}
