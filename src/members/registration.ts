"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import { api } from "../../convex/_generated/api";
import type { GetCurrentMemberOutcome } from "../../convex/contract/member";
import { onboardingHref } from "@/members/onboarding-route";

/**
 * What the client currently knows about the viewer's Member Registration: the
 * public `Members.getCurrent` outcome, plus the state before it first arrives.
 *
 * The `ok` outcome carries the viewer's registered Profile and
 * `registration-required` carries the values that may seed onboarding, so every
 * surface reads one reactive answer instead of re-deriving it.
 */
export type RegistrationState =
  { readonly _tag: "loading" } | GetCurrentMemberOutcome;

/**
 * Subscribe to the viewer's Member Registration state.
 *
 * @returns The reactive Registration state, `loading` until it first arrives.
 */
export function useRegistrationState(): RegistrationState {
  const current = useQuery(api.members.getCurrent, {});

  return current ?? { _tag: "loading" };
}

/** A way into onboarding that resumes the current route afterwards. */
export type OnboardingNavigation = {
  /** The onboarding link, for controls that navigate declaratively. */
  readonly href: string;
  /** Send the Member to onboarding after they attempted a Member-only action. */
  readonly start: () => void;
};

/**
 * Build navigation into onboarding that remembers the current route.
 *
 * The link is built from the pathname alone so routes that render it stay
 * prerenderable; the imperative path runs in an event handler, where the live
 * query string is available and a Member's in-progress intent matters most.
 *
 * @returns The onboarding link and an imperative navigation callback.
 */
export function useOnboardingNavigation(): OnboardingNavigation {
  const pathname = usePathname();
  const router = useRouter();
  const href = onboardingHref(pathname);
  const start = useCallback(() => {
    router.push(
      onboardingHref(`${window.location.pathname}${window.location.search}`),
    );
  }, [router]);

  return { href, start };
}
