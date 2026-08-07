import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { MobileNav } from "@/components/mobile-nav";
import { Composer } from "@/feed/composer";
import { Feed } from "@/feed/feed";

/** Renders the public Feed with the publishing area for signed-in Members. */
export default function Home() {
  return (
    <StillShell activeRoute="feed" auth={<AuthControls />}>
      <h1 className="sr-only">Still — the Feed</h1>
      <MobileNav active="feed" />
      <Composer />
      <section aria-label="Feed" className="mt-8">
        <QueryBoundary regionLabel="the Feed">
          <Feed />
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
