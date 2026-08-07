import type { Metadata } from "next";

import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { RelationshipList } from "@/members/relationship-list";

/** Metadata for the public Followers relationship route. */
export const metadata: Metadata = {
  title: "Followers — Still",
};

/** Renders one Member's public followers list. */
export default async function FollowersPage({
  params,
}: {
  readonly params: Promise<{ readonly memberId: string }>;
}) {
  const { memberId } = await params;

  return (
    <StillShell activeRoute="profile" auth={<AuthControls />}>
      <section aria-labelledby="relationship-list-title">
        <QueryBoundary regionLabel="this relationship list">
          <RelationshipList direction="followers" memberId={memberId} />
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
