import type { Metadata } from "next";

import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { ProfileView } from "@/members/profile-view";

/** Metadata for the public Member Profile route. */
export const metadata: Metadata = {
  title: "Member Profile — Still",
};

/** Renders a Member's public, read-only Profile. */
export default async function MemberProfilePage({
  params,
}: {
  readonly params: Promise<{ readonly memberId: string }>;
}) {
  const { memberId } = await params;

  return (
    <StillShell activeRoute="profile" auth={<AuthControls />}>
      <QueryBoundary regionLabel="this Profile">
        <ProfileView memberId={memberId} />
      </QueryBoundary>
    </StillShell>
  );
}
