"use client";

import Link from "next/link";

import { useOnboardingNavigation } from "@/members/registration";

type OnboardingInviteProps = {
  /** The Member-only workflow the visitor was about to enter, such as “Reply”. */
  readonly action: string;
};

/**
 * Invites an authenticated visitor who has not completed Member Registration
 * to finish it, returning them here afterwards.
 */
export function OnboardingInvite({ action }: OnboardingInviteProps) {
  const { href } = useOnboardingNavigation();

  return (
    <section
      aria-label={`Finish setting up to ${action}`}
      className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5"
    >
      <div>
        <h2 className="text-body font-medium text-ink">
          {`Finish setting up to ${action}.`}
        </h2>
        <p className="mt-1 text-meta text-muted">
          Choose a Handle and display name. Reading needs nothing.
        </p>
      </div>
      <Link
        className="min-h-touch inline-flex items-center rounded-pill bg-sage px-4 text-sm font-medium text-white no-underline transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={href}
      >
        Set up your Member
      </Link>
    </section>
  );
}
