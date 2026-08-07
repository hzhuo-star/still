import type { Metadata } from "next";

import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { ProfileSettings } from "@/members/profile-settings";

/** Metadata for the Still-owned Profile settings route. */
export const metadata: Metadata = {
  title: "Your Profile — Still",
};

/** Renders the Still-owned Profile settings form for the acting Member. */
export default function ProfileSettingsPage() {
  return (
    <StillShell activeRoute="none" auth={<AuthControls />}>
      <section aria-labelledby="profile-settings-title">
        <QueryBoundary regionLabel="your Profile settings">
          <ProfileSettings />
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
