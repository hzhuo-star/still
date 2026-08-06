import { AuthControls } from "@/components/auth-controls";
import { ConnectionStatus } from "@/components/connection-status";
import { StillShell } from "@/components/still-shell";

/** Renders the public tracer-bullet Feed shell. */
export default function Home() {
  return (
    <StillShell auth={<AuthControls />}>
      <section aria-labelledby="feed-title">
        <p className="text-label font-semibold tracking-[0.14em] text-sage uppercase">
          Team preview
        </p>
        <h1 className="mt-3 font-reading text-title text-ink" id="feed-title">
          A quieter place to share a thought.
        </h1>
        <p className="mt-4 max-w-lg text-body text-muted">
          Still is a finite, reading-first Feed. The authenticated publishing
          flow arrives in the next implementation slice.
        </p>

        <div className="mt-8 rounded-card border border-line bg-canvas p-4">
          <p className="text-meta font-semibold tracking-wider text-muted uppercase">
            Deployment status
          </p>
          <div className="mt-3">
            <ConnectionStatus />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="empty-feed"
        className="mt-12 border-t border-line py-10"
      >
        <h2 className="font-reading text-2xl text-ink" id="empty-feed">
          The Feed is ready for its first Post.
        </h2>
        <p className="mt-3 text-body text-muted">
          This deployed shell proves the hosting, authentication, and live
          Convex connection before product behavior is added.
        </p>
        <p className="mt-8 text-center text-sm text-muted">You’re caught up.</p>
      </section>
    </StillShell>
  );
}
