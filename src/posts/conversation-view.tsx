"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import {
  CONVERSATION_REPLY_LIMIT,
  type AuthoredPostView,
  type ConversationEntry,
} from "../../convex/contract/post";
import { PostCard } from "@/posts/post-card";
import { PostListSkeleton } from "@/posts/post-list-skeleton";
import { QuoteComposerProvider } from "@/posts/quote-action";
import { ReplyComposer, ReplyNavigationProvider } from "@/posts/reply-composer";

type ConversationViewProps = {
  /** The untrusted stable Post route segment. */
  readonly postId: string;
  /** Whether navigation requested immediate contextual composition. */
  readonly composeReply: boolean;
};

function PostTombstone({ isRequested }: { readonly isRequested: boolean }) {
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
      <p className="font-reading text-reading text-muted">Post unavailable</p>
      <p className="mt-2 text-meta text-muted">
        This Post was deleted. Its place remains so the Conversation stays
        coherent.
      </p>
    </article>
  );
}

function ConversationEntryCard({
  entry,
  requestedPostId,
}: {
  readonly entry: ConversationEntry;
  readonly requestedPostId: string;
}) {
  const isRequested =
    entry.post.kind === "reply" && entry.post.postId === requestedPostId;
  return entry._tag === "active" ? (
    <PostCard isRequested={isRequested} post={entry.post} />
  ) : (
    <PostTombstone isRequested={isRequested} />
  );
}

function ConversationNotFound() {
  return (
    <section aria-labelledby="conversation-not-found">
      <h1
        className="font-reading text-title text-ink"
        id="conversation-not-found"
      >
        This Conversation isn’t available.
      </h1>
      <p className="mt-3 text-body text-muted">
        The address may be mistyped, or it may point to a Repost wrapper.
      </p>
      <Link
        className="mt-6 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage"
        href="/"
      >
        Back to the Feed
      </Link>
    </section>
  );
}

function requestedTarget(
  root: ConversationEntry,
  replies: ReadonlyArray<ConversationEntry>,
  requestedPostId: string,
): AuthoredPostView | null {
  const requested = [root, ...replies].find(
    (entry) => entry.post.postId === requestedPostId,
  );
  return requested?._tag === "active" ? requested.post : null;
}

function ConversationReplyComposer({
  composeReply,
  openRequest,
  replies,
  requestedPostId,
  root,
}: {
  readonly composeReply: boolean;
  readonly openRequest: number;
  readonly replies: ReadonlyArray<ConversationEntry>;
  readonly requestedPostId: string;
  readonly root: ConversationEntry;
}) {
  const activeTarget = requestedTarget(root, replies, requestedPostId);
  const [target] = useState(activeTarget);

  return target === null ? null : (
    <section aria-label="Reply composer" className="my-6">
      <ReplyComposer
        initiallyOpen={composeReply}
        openRequest={openRequest}
        target={target}
        targetUnavailable={activeTarget === null}
      />
    </section>
  );
}

/**
 * Renders a public reactive, flat, finite Conversation resolved from any
 * active authored Post or structural Post Tombstone URL.
 */
export function ConversationView({
  postId,
  composeReply,
}: ConversationViewProps) {
  const outcome = useQuery(api.posts.getConversation, { postId });
  const [replyOpenRequest, setReplyOpenRequest] = useState(0);

  if (outcome === undefined) {
    return <PostListSkeleton loadingLabel="Loading this Conversation" />;
  }
  if (outcome._tag === "post-not-found") {
    return <ConversationNotFound />;
  }

  return (
    <ReplyNavigationProvider
      postId={outcome.requestedPostId}
      requestOpen={() => {
        setReplyOpenRequest((request) => request + 1);
      }}
    >
      <QuoteComposerProvider>
        <header>
          <p className="text-label font-semibold tracking-wider text-sage uppercase">
            Conversation
          </p>
          <h1 className="mt-2 font-reading text-title text-ink">
            A flat, finite discussion
          </h1>
        </header>

        <section aria-label="Conversation root" className="mt-8">
          <ConversationEntryCard
            entry={outcome.root}
            requestedPostId={outcome.requestedPostId}
          />
        </section>

        <ConversationReplyComposer
          composeReply={composeReply}
          key={outcome.requestedPostId}
          openRequest={replyOpenRequest}
          replies={outcome.replies}
          requestedPostId={outcome.requestedPostId}
          root={outcome.root}
        />

        <section aria-labelledby="conversation-replies" className="mt-8">
          <h2
            className="font-reading text-2xl text-ink"
            id="conversation-replies"
          >
            Replies
          </h2>
          {outcome.replies.length === 0 ? (
            <p className="border-t border-line py-8 text-body text-muted">
              No Replies yet.
            </p>
          ) : (
            <ol className="m-0 mt-4 list-none p-0">
              {outcome.replies.map((entry) => (
                <li key={entry.post.postId}>
                  <ConversationEntryCard
                    entry={entry}
                    requestedPostId={outcome.requestedPostId}
                  />
                </li>
              ))}
            </ol>
          )}
          <p className="border-t border-line py-8 text-center text-sm text-muted">
            {outcome.ending === "complete"
              ? "You’re caught up."
              : outcome.requestedReplyWasOutsideWindow
                ? `Showing the requested Reply and the latest ${CONVERSATION_REPLY_LIMIT - 1} replies.`
                : `Showing the latest ${CONVERSATION_REPLY_LIMIT} replies.`}
          </p>
        </section>
      </QuoteComposerProvider>
    </ReplyNavigationProvider>
  );
}
