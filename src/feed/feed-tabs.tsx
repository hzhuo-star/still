import Link from "next/link";

type FeedTabsProps = {
  /** The Feed route the tabs are rendered on, marked current. */
  readonly active: "feed" | "following";
};

const tabClassName = (isCurrent: boolean): string =>
  `flex min-h-touch flex-1 items-center justify-center border-b-2 text-sm font-medium no-underline transition-colors ease-still ${
    isCurrent
      ? "border-sage text-ink"
      : "border-transparent text-muted hover:text-ink"
  }`;

/**
 * Compact navigation between the public Feed and the Following Feed for
 * viewports where the primary navigation rail is hidden.
 */
export function FeedTabs({ active }: FeedTabsProps) {
  return (
    <nav
      aria-label="Feeds"
      className="mb-6 flex border-b border-line shell:hidden"
    >
      <Link
        aria-current={active === "feed" ? "page" : undefined}
        className={tabClassName(active === "feed")}
        href="/"
      >
        Feed
      </Link>
      <Link
        aria-current={active === "following" ? "page" : undefined}
        className={tabClassName(active === "following")}
        href="/following"
      >
        Following
      </Link>
    </nav>
  );
}
