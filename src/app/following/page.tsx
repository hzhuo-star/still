import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { FeedTabs } from "@/feed/feed-tabs";
import { FollowingFeed } from "@/feed/following-feed";

/** Renders the viewer's own Following Feed beside the public Feed route. */
export default function Following() {
  return (
    <StillShell activeRoute="following" auth={<AuthControls />}>
      <h1 className="sr-only">Still — your Following Feed</h1>
      <FeedTabs active="following" />
      <section aria-label="Following Feed">
        <QueryBoundary regionLabel="your Following Feed">
          <FollowingFeed />
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
