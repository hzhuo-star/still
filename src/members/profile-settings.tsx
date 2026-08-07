"use client";

import { useMutation } from "convex/react";
import Link from "next/link";

import { api } from "../../convex/_generated/api";
import { OnboardingInvite } from "@/members/onboarding-invite";
import {
  ProfileForm,
  type ProfileFormOutcome,
  type ProfileSubmission,
} from "@/members/profile-form";
import { useRegistrationState } from "@/members/registration";

function SettingsHeading() {
  return (
    <h1
      className="font-reading text-title text-ink"
      id="profile-settings-title"
    >
      Your Profile
    </h1>
  );
}

/**
 * The Still-owned Profile settings surface: the registered Member's current
 * Handle, display name, and biography, editable through the same parsers and
 * accessible form that Member Registration uses.
 *
 * Clerk keeps credentials and the identity image, so neither appears here.
 */
export function ProfileSettings() {
  const registration = useRegistrationState();
  const updateCurrent = useMutation(api.members.updateCurrent);

  if (registration._tag === "loading") {
    return (
      <>
        <SettingsHeading />
        <p className="mt-8 text-body text-muted" role="status">
          Loading your Profile…
        </p>
      </>
    );
  }

  if (registration._tag === "unauthenticated") {
    return (
      <>
        <SettingsHeading />
        <p className="mt-4 text-body text-muted">
          Sign in to edit the Profile other Members see.
        </p>
        <Link
          className="mt-6 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/"
        >
          Back to the Feed
        </Link>
      </>
    );
  }

  if (registration._tag === "registration-required") {
    return (
      <>
        <SettingsHeading />
        <div className="mt-6">
          <OnboardingInvite action="edit your Profile" />
        </div>
      </>
    );
  }

  const profile = registration.profile;
  const save = async (
    submission: ProfileSubmission,
  ): Promise<ProfileFormOutcome> => await updateCurrent(submission);

  return (
    <>
      <SettingsHeading />
      <p className="mt-4 text-body text-muted">
        Still owns your Handle, display name, and biography. Your identity image
        continues to come from your account.
      </p>
      <ProfileForm
        failureTitle="Still could not save your Profile."
        idPrefix="profile-settings"
        initial={{
          handle: profile.handle,
          displayName: profile.displayName,
          biography: profile.biography ?? "",
        }}
        pendingLabel="Saving…"
        savedMessage="Profile saved."
        submit={save}
        submitLabel="Save Profile"
      />
      <Link
        className="mt-8 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={`/members/${profile.memberId}`}
      >
        View your public Profile
      </Link>
    </>
  );
}
