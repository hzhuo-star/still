import Link from "next/link";

type MobileNavProps = {
  /** The route the tabs are rendered on, marked current. */
  readonly active: "feed" | "following" | "search";
};

const tabClassName = (isCurrent: boolean): string =>
  `flex min-h-touch flex-1 items-center justify-center border-b-2 text-sm font-medium no-underline transition-colors ease-still ${
    isCurrent
      ? "border-sage text-ink"
      : "border-transparent text-muted hover:text-ink"
  }`;

/**
 * Compact tab navigation between Still's destinations for viewports where
 * the primary navigation rail is hidden; the rail replaces it on wide shells.
 */
export function MobileNav({ active }: MobileNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
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
      <Link
        aria-current={active === "search" ? "page" : undefined}
        className={tabClassName(active === "search")}
        href="/search"
      >
        Search
      </Link>
    </nav>
  );
}
