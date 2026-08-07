"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "../../convex/_generated/api";
import type {
  MemberRegistrationDefaults,
  RegisterCurrentMemberOutcome,
} from "../../convex/contract/member";
import * as MemberProfile from "../../convex/lib/memberProfile";
import { casesHandled } from "../../convex/lib/result";
import {
  parseReturnPath,
  RETURN_PARAM,
  type ReturnPath,
} from "@/members/onboarding-route";
import { useRegistrationState } from "@/members/registration";

/**
 * Every expected failure the onboarding form can present: the Registration
 * outcomes that are not progress, plus an unreachable backend.
 */
type OnboardingFailure =
  | Exclude<
      RegisterCurrentMemberOutcome,
      { readonly _tag: "ok" } | { readonly _tag: "already-registered" }
    >
  | { readonly _tag: "connection" };

type OnboardingState =
  | { readonly _tag: "editing"; readonly failure: OnboardingFailure | null }
  | { readonly _tag: "pending" };

const fieldIds = {
  handle: "onboarding-handle",
  "display-name": "onboarding-display-name",
  biography: "onboarding-biography",
} as const;

function invalidProfileMessage(
  field: MemberProfile.ProfileField,
  reason: MemberProfile.InvalidProfileReason,
): string {
  if (field === "handle") {
    switch (reason) {
      case "empty":
        return "Choose a Handle so other Members can find you.";
      case "too-short":
        return `Handles use at least ${MemberProfile.MIN_HANDLE_LENGTH} characters.`;
      case "too-long":
        return `Handles use at most ${MemberProfile.MAX_HANDLE_LENGTH} characters.`;
      case "invalid-format":
        return "Handles use letters, digits, and underscores, and start with a letter or digit.";
      default:
        return casesHandled(reason);
    }
  }

  if (field === "display-name") {
    return reason === "empty"
      ? "Enter the display name you want on your Profile."
      : `Display names hold at most ${MemberProfile.MAX_DISPLAY_NAME_LENGTH} characters.`;
  }

  return `Biographies hold at most ${MemberProfile.MAX_BIOGRAPHY_LENGTH} characters.`;
}

function failureMessage(failure: OnboardingFailure): string {
  switch (failure._tag) {
    case "invalid-profile":
      return invalidProfileMessage(failure.field, failure.reason);
    case "handle-unavailable":
      return `@${failure.handle} is already taken. Choose another Handle.`;
    case "unauthenticated":
      return "Your session ended. Sign in again to finish setting up.";
    case "connection":
      return "Registration didn’t reach Still. Your answers are safe — try again.";
    default:
      return casesHandled(failure);
  }
}

/** The form field a failure belongs to, or `null` when it belongs to neither. */
function failureField(
  failure: OnboardingFailure,
): MemberProfile.ProfileField | null {
  switch (failure._tag) {
    case "invalid-profile":
      return failure.field;
    case "handle-unavailable":
      return "handle";
    case "unauthenticated":
    case "connection":
      return null;
    default:
      return casesHandled(failure);
  }
}

function biographyAnnouncement(remaining: number): string {
  if (remaining < 0) {
    return `Over the ${MemberProfile.MAX_BIOGRAPHY_LENGTH} character limit.`;
  }

  if (remaining <= 20 && remaining % 10 === 0) {
    return `${remaining} characters left.`;
  }

  return "";
}

const labelClassName = "block text-body font-medium text-ink";
const inputClassName =
  "mt-2 min-h-touch w-full rounded-control border border-line bg-surface px-3 text-body text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-danger";
const hintClassName = "mt-1 text-meta text-muted";

function OnboardingFields({
  defaults,
  returnPath,
}: {
  readonly defaults: MemberRegistrationDefaults;
  readonly returnPath: ReturnPath;
}) {
  const router = useRouter();
  const registerCurrent = useMutation(api.members.registerCurrent);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState(defaults.displayName);
  const [biography, setBiography] = useState("");
  const [state, setState] = useState<OnboardingState>({
    _tag: "editing",
    failure: null,
  });
  const summaryRef = useRef<HTMLDivElement>(null);

  const pending = state._tag === "pending";
  const failure = state._tag === "editing" ? state.failure : null;
  const invalidField = failure === null ? null : failureField(failure);
  const remaining = MemberProfile.remainingBiographyCharacters(biography);

  const fail = (next: OnboardingFailure) => {
    setState({ _tag: "editing", failure: next });
    summaryRef.current?.focus();
  };

  const submit = async () => {
    const draft = MemberProfile.parse({ handle, displayName, biography });

    if (draft._tag === "err") {
      fail({
        _tag: "invalid-profile",
        field: draft.error.field,
        reason: draft.error.reason,
      });
      return;
    }

    setState({ _tag: "pending" });

    try {
      const outcome = await registerCurrent({
        handle: draft.value.handle,
        displayName: draft.value.displayName,
        biography:
          draft.value.biography._tag === "absent"
            ? ""
            : draft.value.biography.text,
      });

      switch (outcome._tag) {
        case "ok":
        case "already-registered":
          router.replace(returnPath);
          return;
        case "invalid-profile":
        case "handle-unavailable":
        case "unauthenticated":
          fail(outcome);
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      fail({ _tag: "connection" });
    }
  };

  return (
    <form
      className="mt-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        if (!pending) {
          void submit();
        }
      }}
    >
      <div
        className={
          failure === null
            ? "sr-only"
            : "rounded-card border border-danger/20 bg-danger-soft p-4"
        }
        ref={summaryRef}
        role="alert"
        tabIndex={-1}
      >
        {failure === null ? null : (
          <>
            <h2 className="text-body font-semibold text-danger">
              Still could not finish setting up your Member.
            </h2>
            <p className="mt-1 text-body text-ink">
              {invalidField === null ? (
                failureMessage(failure)
              ) : (
                <a
                  className="text-danger underline"
                  href={`#${fieldIds[invalidField]}`}
                >
                  {failureMessage(failure)}
                </a>
              )}
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <label className={labelClassName} htmlFor={fieldIds.handle}>
          Handle
        </label>
        <input
          aria-describedby="onboarding-handle-hint"
          aria-invalid={invalidField === "handle"}
          autoComplete="off"
          className={inputClassName}
          id={fieldIds.handle}
          name="handle"
          onChange={(event) => {
            setHandle(event.target.value);
            setState({ _tag: "editing", failure: null });
          }}
          placeholder="quiet_reader"
          readOnly={pending}
          spellCheck={false}
          type="text"
          value={handle}
        />
        <p className={hintClassName} id="onboarding-handle-hint">
          {`${MemberProfile.MIN_HANDLE_LENGTH}–${MemberProfile.MAX_HANDLE_LENGTH} letters, digits, or underscores, starting with a letter or digit. Handles are lowercase, so capitals become lowercase.`}
        </p>
      </div>

      <div className="mt-6">
        <label className={labelClassName} htmlFor={fieldIds["display-name"]}>
          Display name
        </label>
        <input
          aria-invalid={invalidField === "display-name"}
          autoComplete="name"
          className={inputClassName}
          id={fieldIds["display-name"]}
          name="displayName"
          onChange={(event) => {
            setDisplayName(event.target.value);
            setState({ _tag: "editing", failure: null });
          }}
          readOnly={pending}
          type="text"
          value={displayName}
        />
      </div>

      <div className="mt-6">
        <label className={labelClassName} htmlFor={fieldIds.biography}>
          Biography <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          aria-describedby="onboarding-biography-counter"
          aria-invalid={invalidField === "biography"}
          className={`${inputClassName} min-h-24 resize-y py-2 font-reading`}
          id={fieldIds.biography}
          name="biography"
          onChange={(event) => {
            setBiography(event.target.value);
            setState({ _tag: "editing", failure: null });
          }}
          placeholder="A sentence about what you read and write."
          readOnly={pending}
          rows={3}
          value={biography}
        />
        <p
          className={`mt-1 text-meta ${remaining < 0 ? "font-medium text-danger" : "text-muted"}`}
          id="onboarding-biography-counter"
        >
          {remaining >= 0
            ? `${remaining} characters left`
            : `${-remaining} characters over`}
        </p>
        <p className="sr-only" role="status">
          {biographyAnnouncement(remaining)}
        </p>
      </div>

      <button
        className="mt-8 min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? "Setting up…" : "Enter Still"}
      </button>
    </form>
  );
}

function OnboardingPending() {
  return (
    <p className="mt-8 text-body text-muted" role="status">
      Checking whether you have finished setting up…
    </p>
  );
}

/**
 * The one-screen Member Registration surface: an authenticated visitor chooses
 * a Handle and display name, optionally writes a biography, and returns to
 * whatever they were doing once Registration succeeds.
 */
export function OnboardingForm() {
  const searchParams = useSearchParams();
  const returnPath = parseReturnPath(searchParams.get(RETURN_PARAM));
  const router = useRouter();
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
        <OnboardingPending />
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

  return (
    <>
      <OnboardingHeading />
      <p className="mt-4 text-body text-muted">
        Choose how you appear on Still. You can read without this, but
        publishing, Replies, Likes, and Reposts need a Member.
      </p>
      <OnboardingFields
        defaults={registration.defaults}
        returnPath={returnPath}
      />
    </>
  );
}

function OnboardingHeading() {
  return (
    <h1 className="font-reading text-title text-ink" id="onboarding-title">
      Set up your Member
    </h1>
  );
}
