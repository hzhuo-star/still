import { Suspense } from "react";

import { AuthControls } from "@/components/auth-controls";
import { MobileNav } from "@/components/mobile-nav";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { SearchView } from "@/search/search-view";

function SearchFallback() {
  return (
    <p className="text-body text-muted" role="status">
      Loading Search…
    </p>
  );
}

/**
 * Renders the public Search surface. The client view reads its query and tab
 * from the URL, so it mounts inside a Suspense boundary and the rest of the
 * page stays prerenderable.
 */
export default function Search() {
  return (
    <StillShell activeRoute="search" auth={<AuthControls />}>
      <h1 className="sr-only">Still — Search</h1>
      <MobileNav active="search" />
      <section aria-label="Search">
        <QueryBoundary regionLabel="Search">
          <Suspense fallback={<SearchFallback />}>
            <SearchView />
          </Suspense>
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
