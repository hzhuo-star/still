"use client";

import type { ListEnding, PostView } from "../../convex/postContract";
import { ListEndingNotice } from "@/posts/list-ending";
import { PostCard } from "@/posts/post-card";

type PostListProps = {
  /** The Posts to render, newest first. */
  readonly posts: ReadonlyArray<PostView>;
  /** Whether the list is complete or bounded at the newest 50. */
  readonly ending: ListEnding;
};

/**
 * Renders a bounded list of Posts followed by its honest ending notice,
 * shared by the Feed and Member Profiles.
 */
export function PostList({ posts, ending }: PostListProps) {
  return (
    <>
      <ul className="m-0 list-none p-0">
        {posts.map((post) => (
          <li key={post.postId}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
      <ListEndingNotice ending={ending} />
    </>
  );
}
