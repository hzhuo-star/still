"use client";

import { useRef, useState } from "react";

import type { InvalidMemberProfileOutcome } from "../../convex/contract/member";
import * as MemberProfile from "../../convex/lib/memberProfile";
import { casesHandled } from "../../convex/lib/result";
import { counterAnnouncement } from "@/components/character-counter";

/** The Still-owned Profile values a form submits. */
export type ProfileSubmission = {
  /** The requested public Handle. */
  readonly handle: string;
  /** The requested display name. */
  readonly displayName: string;
  /** The optional biography; blank text stores no biography. */
  readonly biography: string;
};

/**
 * What a Profile submission can produce.
 *
 * Registration and Profile editing return different tagged unions, so each
 * caller narrows its own outcome to this shared shape before the form presents
 * it. `ok` means the authoritative write succeeded.
 */
export type ProfileFormOutcome =
  | { readonly _tag: "ok" }
  | InvalidMemberProfileOutcome
  | { readonly _tag: "handle-unavailable"; readonly handle: string }
  | { readonly _tag: "unauthenticated" }
  | { readonly _tag: "registration-required" };

/** Every expected failure a Profile form can present, plus an unreachable backend. */
type ProfileFormFailure =
  | Exclude<ProfileFormOutcome, { readonly _tag: "ok" }>
  | { readonly _tag: "connection" };

type ProfileFormState =
  | { readonly _tag: "editing"; readonly failure: ProfileFormFailure | null }
  | { readonly _tag: "pending" }
  | { readonly _tag: "saved" };

type ProfileFormProps = {
  /** A stable prefix making this form's control ids unique on its page. */
  readonly idPrefix: string;
  /** The values the form opens with. */
  readonly initial: ProfileSubmission;
  /** The label on the idle submit control. */
  readonly submitLabel: string;
  /** The label shown while the authoritative write is in flight. */
  readonly pendingLabel: string;
  /** The error-summary heading describing what could not be completed. */
  readonly failureTitle: string;
  /** The status message shown after a successful write, when the form stays. */
  readonly savedMessage?: string;
  /** Perform the authoritative write for one parsed submission. */
  readonly submit: (
    submission: ProfileSubmission,
  ) => Promise<ProfileFormOutcome>;
};

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

function failureMessage(failure: ProfileFormFailure): string {
  switch (failure._tag) {
    case "invalid-profile":
      return invalidProfileMessage(failure.field, failure.reason);
    case "handle-unavailable":
      return `@${failure.handle} is already taken. Choose another Handle.`;
    case "unauthenticated":
      return "Your session ended. Sign in again to save this.";
    case "registration-required":
      return "Finish setting up your Member before editing your Profile.";
    case "connection":
      return "Your changes didn’t reach Still. They are safe here — try again.";
    default:
      return casesHandled(failure);
  }
}

/** The form field a failure belongs to, or `null` when it belongs to none. */
function failureField(
  failure: ProfileFormFailure,
): MemberProfile.ProfileField | null {
  switch (failure._tag) {
    case "invalid-profile":
      return failure.field;
    case "handle-unavailable":
      return "handle";
    case "unauthenticated":
    case "registration-required":
    case "connection":
      return null;
    default:
      return casesHandled(failure);
  }
}

const labelClassName = "block text-body font-medium text-ink";
const inputClassName =
  "mt-2 min-h-touch w-full rounded-control border border-line bg-surface px-3 text-body text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-danger";
const hintClassName = "mt-1 text-meta text-muted";

/**
 * The accessible form behind both Member Registration and Profile editing:
 * the same three Still-owned fields, the same parsers, the same error summary
 * and field association, and the same pending and failure handling.
 *
 * Entered values live here and survive every failure, so a rejected Handle or
 * an unreachable backend never costs a Member their work.
 */
export function ProfileForm({
  idPrefix,
  initial,
  submitLabel,
  pendingLabel,
  failureTitle,
  savedMessage,
  submit,
}: ProfileFormProps) {
  const [handle, setHandle] = useState(initial.handle);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [biography, setBiography] = useState(initial.biography);
  const [state, setState] = useState<ProfileFormState>({
    _tag: "editing",
    failure: null,
  });
  const summaryRef = useRef<HTMLDivElement>(null);

  const fieldIds = {
    handle: `${idPrefix}-handle`,
    "display-name": `${idPrefix}-display-name`,
    biography: `${idPrefix}-biography`,
  } as const satisfies Record<MemberProfile.ProfileField, string>;

  const pending = state._tag === "pending";
  const failure = state._tag === "editing" ? state.failure : null;
  const invalidField = failure === null ? null : failureField(failure);
  const remaining = MemberProfile.remainingBiographyCharacters(biography);

  const fail = (next: ProfileFormFailure) => {
    setState({ _tag: "editing", failure: next });
    summaryRef.current?.focus();
  };

  const edited = () => {
    setState({ _tag: "editing", failure: null });
  };

  const save = async () => {
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
      // Submit what the parser produced, so the authoritative write receives
      // exactly the values this form validated.
      const outcome = await submit({
        handle: draft.value.handle,
        displayName: draft.value.displayName,
        biography:
          draft.value.biography._tag === "absent"
            ? ""
            : draft.value.biography.text,
      });

      switch (outcome._tag) {
        case "ok":
          setHandle(draft.value.handle);
          setDisplayName(draft.value.displayName);
          setBiography(
            draft.value.biography._tag === "absent"
              ? ""
              : draft.value.biography.text,
          );
          setState({ _tag: "saved" });
          return;
        case "invalid-profile":
        case "handle-unavailable":
        case "unauthenticated":
        case "registration-required":
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
          void save();
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
              {failureTitle}
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
          aria-describedby={`${idPrefix}-handle-hint`}
          aria-invalid={invalidField === "handle"}
          autoComplete="off"
          className={inputClassName}
          id={fieldIds.handle}
          name="handle"
          onChange={(event) => {
            setHandle(event.target.value);
            edited();
          }}
          placeholder="quiet_reader"
          readOnly={pending}
          spellCheck={false}
          type="text"
          value={handle}
        />
        <p className={hintClassName} id={`${idPrefix}-handle-hint`}>
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
            edited();
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
          aria-describedby={`${idPrefix}-biography-counter`}
          aria-invalid={invalidField === "biography"}
          className={`${inputClassName} min-h-24 resize-y py-2 font-reading`}
          id={fieldIds.biography}
          name="biography"
          onChange={(event) => {
            setBiography(event.target.value);
            edited();
          }}
          placeholder="A sentence about what you read and write."
          readOnly={pending}
          rows={3}
          value={biography}
        />
        <p
          className={`mt-1 text-meta ${remaining < 0 ? "font-medium text-danger" : "text-muted"}`}
          id={`${idPrefix}-biography-counter`}
        >
          {remaining >= 0
            ? `${remaining} characters left`
            : `${-remaining} characters over`}
        </p>
        <p className="sr-only" role="status">
          {counterAnnouncement(remaining, MemberProfile.MAX_BIOGRAPHY_LENGTH)}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-70"
          disabled={pending}
          type="submit"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {state._tag === "saved" && savedMessage !== undefined ? (
          <p className="text-body text-muted" role="status">
            {savedMessage}
          </p>
        ) : null}
      </div>
    </form>
  );
}
