"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { api } from "../../convex/_generated/api";
import { parseReturnPath, RETURN_PARAM } from "@/members/onboarding-route";
import {
  ProfileForm,
  type ProfileFormOutcome,
  type ProfileSubmission,
} from "@/members/profile-form";
import { useRegistrationState } from "@/members/registration";

function OnboardingHeading() {
  return (
    <h1 className="font-reading text-title text-ink" id="onboarding-title">
      Set up your Member
    </h1>
  );
}

/**
 * The one-screen Member Registration surface: an authenticated visitor chooses
 * a Handle and display name, optionally writes a biography, and returns to
 * whatever they were doing once Registration succeeds.
 *
 * A visitor who is already registered never sees the form; they resume the
 * route they came from instead.
 */
export function OnboardingForm() {
  const searchParams = useSearchParams();
  const returnPath = parseReturnPath(searchParams.get(RETURN_PARAM));
  const router = useRouter();
  const registerCurrent = useMutation(api.members.registerCurrent);
  const registration = useRegistrationState();
  const alreadyRegistered = registration._tag === "ok";

  useEffect(() => {
    if (alreadyRegistered) {
      router.replace(returnPath);
    }
  }, [alreadyRegistered, returnPath, router]);

  if (registration._tag === "loading") {
    return (
      <>
        <OnboardingHeading />
        <p className="mt-8 text-body text-muted" role="status">
          Checking whether you have finished setting up…
        </p>
      </>
    );
  }

  if (registration._tag === "unauthenticated") {
    return (
      <>
        <OnboardingHeading />
        <p className="mt-4 text-body text-muted">
          Sign in first, then choose the Handle other Members will see.
        </p>
        <SignInButton>
          <button
            className="mt-6 min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
      </>
    );
  }

  if (registration._tag === "ok") {
    return (
      <>
        <OnboardingHeading />
        <p className="mt-8 text-body text-muted" role="status">
          {`You are already set up as @${registration.profile.handle}. Taking you back…`}
        </p>
      </>
    );
  }

  const register = async (
    submission: ProfileSubmission,
  ): Promise<ProfileFormOutcome> => {
    const outcome = await registerCurrent(submission);

    // A repeat submission that already succeeded is progress, not a failure.
    if (outcome._tag === "ok" || outcome._tag === "already-registered") {
      router.replace(returnPath);
      return { _tag: "ok" };
    }

    return outcome;
  };

  return (
    <>
      <OnboardingHeading />
      <p className="mt-4 text-body text-muted">
        Choose how you appear on Still. You can read without this, but
        publishing, Replies, Likes, and Reposts need a Member.
      </p>
      <ProfileForm
        failureTitle="Still could not finish setting up your Member."
        idPrefix="onboarding"
        initial={{
          handle: "",
          displayName: registration.defaults.displayName,
          biography: "",
        }}
        pendingLabel="Setting up…"
        submit={register}
        submitLabel="Enter Still"
      />
    </>
  );
}
