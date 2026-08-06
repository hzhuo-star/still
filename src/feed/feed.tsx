"use client";

import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { ListEndingNotice } from "@/posts/list-ending";
import { PostCard } from "@/posts/post-card";
import { PostListSkeleton } from "@/posts/post-list-skeleton";

function EmptyFeed() {
  return (
    <section
      aria-labelledby="empty-feed"
      className="border-t border-line py-10"
    >
      <h2 className="font-reading text-2xl text-ink" id="empty-feed">
        The Feed is ready for its first Post.
      </h2>
      <p className="mt-3 text-body text-muted">
        New Posts appear here live, without a refresh. Sign in to publish the
        first thought.
      </p>
    </section>
  );
}

/**
 * The public reactive Feed: the newest 50 Posts, newest first, with its own
 * loading skeleton, a useful empty state, and an honest finite ending.
 */
export function Feed() {
  const feed = useQuery(api.posts.listFeed);

  if (feed === undefined) {
    return <PostListSkeleton loadingLabel="Loading the Feed" />;
  }

  if (feed.posts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <>
      <ul className="m-0 list-none p-0">
        {feed.posts.map((post) => (
          <li key={post.postId}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
      <ListEndingNotice ending={feed.ending} />
    </>
  );
}
