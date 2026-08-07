"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "../../convex/_generated/api";
import { onboardingHref } from "@/members/onboarding-route";

/**
 * Idempotently projects the signed-in Clerk identity into a pending Member
 * once the Convex connection is authenticated, and sends an identity that has
 * just arrived to onboarding so it never enters the application as a usable
 * Member by accident. Renders nothing.
 *
 * Only the projection that first creates the Member navigates. A Member who is
 * still deciding, or a legacy identity that predates onboarding, keeps reading
 * and reaches onboarding through the affordances beside Member-only controls.
 */
export function MemberSync() {
  const { isAuthenticated } = useConvexAuth();
  const ensureCurrent = useMutation(api.members.ensureCurrent);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // A failed refresh is safe to ignore: every Member-only write resolves the
    // acting Member again before acting.
    ensureCurrent({})
      .then((outcome) => {
        if (
          outcome._tag === "ok" &&
          outcome.projection === "created" &&
          outcome.registrationState === "pending"
        ) {
          // Read the route where the projection resolved, so a Member who
          // navigated mid-projection still returns to where they are.
          router.replace(
            onboardingHref(
              `${window.location.pathname}${window.location.search}`,
            ),
          );
        }
      })
      .catch(() => undefined);
  }, [ensureCurrent, isAuthenticated, router]);

  return null;
}
