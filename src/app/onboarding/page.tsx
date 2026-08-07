import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthControls } from "@/components/auth-controls";
import { QueryBoundary } from "@/components/query-boundary";
import { StillShell } from "@/components/still-shell";
import { OnboardingForm } from "@/members/onboarding-form";

/** Metadata for the one-time Member Registration route. */
export const metadata: Metadata = {
  title: "Set up your Member — Still",
};

/** Renders the focused Member Registration surface. */
export default function OnboardingPage() {
  return (
    <StillShell activeRoute="none" auth={<AuthControls />}>
      <section aria-labelledby="onboarding-title">
        <QueryBoundary regionLabel="your Member setup">
          <Suspense
            fallback={
              <p className="text-body text-muted" role="status">
                Preparing your setup…
              </p>
            }
          >
            <OnboardingForm />
          </Suspense>
        </QueryBoundary>
      </section>
    </StillShell>
  );
}
