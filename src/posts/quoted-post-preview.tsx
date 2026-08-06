import Link from "next/link";

import type { QuoteReferenceView } from "../../convex/contract/post";

type QuotedPostPreviewProps = {
  /** The shallow live target or an unavailable projection. */
  readonly reference: QuoteReferenceView;
};

/** Renders exactly one non-recursive Quote target preview. */
export function QuotedPostPreview({ reference }: QuotedPostPreviewProps) {
  if (reference._tag === "unavailable") {
    return (
      <div className="mt-3 rounded-card border border-line p-3 text-body text-muted">
        Quoted Post unavailable
      </div>
    );
  }

  const { post } = reference;
  return (
    <div className="mt-3 rounded-card border border-line p-3">
      <p className="text-meta text-muted">
        <Link
          className="inline-flex min-h-touch min-w-touch items-center font-medium text-ink no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          href={`/members/${post.author.memberId}`}
        >
          {post.author.displayName}
        </Link>
        {` · ${post.kind === "reply" ? "Reply" : post.kind === "quote" ? "Quote Post" : "Post"}`}
      </p>
      <Link
        className="block min-h-touch text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        href={`/posts/${post.postId}`}
      >
        <p className="mt-2 font-reading text-body whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
          {post.content}
        </p>
      </Link>
    </div>
  );
}
