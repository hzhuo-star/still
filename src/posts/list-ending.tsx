import type { ListEnding } from "../../convex/posts";

type ListEndingNoticeProps = {
  /** Whether the list contains every available Post or only the newest 50. */
  readonly ending: ListEnding;
};

/**
 * Ends a Post list honestly: a complete list closes with “You’re caught
 * up.” while a truncated list discloses the 50-Post bound. Quieter than
 * Post content and readable by assistive technology as ordinary text.
 */
export function ListEndingNotice({ ending }: ListEndingNoticeProps) {
  return (
    <p className="border-t border-line py-8 text-center text-sm text-muted">
      {ending === "complete"
        ? "You’re caught up."
        : "Showing the latest 50 posts."}
    </p>
  );
}
