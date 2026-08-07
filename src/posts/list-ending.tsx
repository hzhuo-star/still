import type { ListEnding } from "../../convex/contract/list";
import { FEED_LIMIT } from "../../convex/contract/post";

type ListEndingNoticeProps = {
  /** Whether the list contains every available Post or only its bound. */
  readonly ending: ListEnding;
  /** Copy disclosing a truncated list's bound; the Feed's 50-Post default. */
  readonly truncatedNotice?: string;
};

/**
 * Ends a Post list honestly: a complete list closes with “You’re caught
 * up.” while a truncated list discloses its bound. Quieter than Post
 * content and readable by assistive technology as ordinary text.
 */
export function ListEndingNotice({
  ending,
  truncatedNotice,
}: ListEndingNoticeProps) {
  return (
    <p className="border-t border-line py-8 text-center text-sm text-muted">
      {ending === "complete"
        ? "You’re caught up."
        : (truncatedNotice ?? `Showing the latest ${FEED_LIMIT} posts.`)}
    </p>
  );
}
