"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import {
  useOnboardingNavigation,
  useRegistrationState,
} from "@/members/registration";

function MemberStatus() {
  const registration = useRegistrationState();
  const { href } = useOnboardingNavigation();

  if (registration._tag === "registration-required") {
    return (
      <Link
        className="min-h-touch inline-flex items-center rounded-pill bg-sage px-3 text-sm font-medium text-white no-underline transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        href={href}
      >
        Finish setting up
      </Link>
    );
  }

  if (registration._tag === "ok") {
    return (
      <Link
        className="hidden min-h-touch items-center text-meta text-muted no-underline hover:text-ink focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas feed:inline-flex"
        href="/settings/profile"
      >
        {`@${registration.profile.handle}`}
      </Link>
    );
  }

  return (
    <span className="hidden text-meta text-muted feed:inline">
      Preview member
    </span>
  );
}

/**
 * Renders the Clerk sign-in entry point, or the signed-in account menu beside
 * the Member's state — including the route into outstanding onboarding.
 */
export function AuthControls() {
  return (
    <div className="flex min-h-touch items-center justify-end gap-3">
      <Show when="signed-out">
        <SignInButton>
          <button
            className="min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <MemberStatus />
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "size-touch" } }}
        />
      </Show>
    </div>
  );
}
