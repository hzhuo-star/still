import Link from "next/link";

import { tabLinkClassName } from "@/components/tab-link";

type MobileNavProps = {
  /** The route the tabs are rendered on, marked current. */
  readonly active: "feed" | "following" | "search";
};

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
        className={tabLinkClassName(active === "feed")}
        href="/"
      >
        Feed
      </Link>
      <Link
        aria-current={active === "following" ? "page" : undefined}
        className={tabLinkClassName(active === "following")}
        href="/following"
      >
        Following
      </Link>
      <Link
        aria-current={active === "search" ? "page" : undefined}
        className={tabLinkClassName(active === "search")}
        href="/search"
      >
        Search
      </Link>
    </nav>
  );
}
