"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "../../convex/_generated/api";
import type { AuthoredPostView } from "../../convex/contract/post";
import * as PostContent from "../../convex/lib/postContent";
import { casesHandled } from "../../convex/lib/result";
import {
  useOnboardingNavigation,
  useRegistrationState,
} from "@/members/registration";
import { QuotedPostPreview } from "@/posts/quoted-post-preview";

type QuoteActionProps = {
  /** The authored Post selected as the Quote target. */
  readonly post: AuthoredPostView;
};

type QuoteComposerProviderProps = {
  /** Post cards whose Quote actions share one persistent composer host. */
  readonly children: ReactNode;
};

type QuoteFailure =
  | "too-long"
  | "unauthenticated"
  | "already-reposted"
  | "target-not-found"
  | "target-deleted"
  | "connection";

type QuoteComposerState =
  | {
      readonly _tag: "editing";
      readonly draft: string;
      readonly failure: QuoteFailure | null;
    }
  | { readonly _tag: "pending"; readonly draft: string };

type QuoteSelection = {
  readonly post: AuthoredPostView;
  readonly trigger: HTMLButtonElement;
};

type QuoteComposerContextValue = {
  readonly open: (post: AuthoredPostView, trigger: HTMLButtonElement) => void;
};

const QuoteComposerContext = createContext<QuoteComposerContextValue | null>(
  null,
);

const actionClassName =
  "flex min-h-touch min-w-touch cursor-pointer items-center justify-center bg-transparent p-0 text-sm text-muted transition-colors ease-still hover:text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-60";

function failureMessage(reason: QuoteFailure): string {
  switch (reason) {
    case "too-long":
      return `Quote commentary holds at most ${PostContent.MAX_POST_LENGTH} characters.`;
    case "unauthenticated":
      return "Your session ended. Sign in again to Quote.";
    case "already-reposted":
      return "You already Reposted this Post. Add commentary to publish a Quote Post.";
    case "target-not-found":
      return "This Post is no longer available.";
    case "target-deleted":
      return "This Post was deleted and can no longer be quoted.";
    case "connection":
      return "Your Quote didn’t reach Still. Your draft is safe — try again.";
    default:
      return casesHandled(reason);
  }
}

function useQuoteComposer(): QuoteComposerContextValue {
  const composer = useContext(QuoteComposerContext);
  if (composer === null) {
    throw new Error(
      "QuoteAction must be rendered inside QuoteComposerProvider",
    );
  }
  return composer;
}

function QuoteComposer({
  selection,
  close,
}: {
  readonly selection: QuoteSelection;
  readonly close: () => void;
}) {
  const { post, trigger } = selection;
  const [state, setState] = useState<QuoteComposerState>({
    _tag: "editing",
    draft: "",
    failure: null,
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createQuote = useMutation(api.posts.createQuote);
  const onboarding = useOnboardingNavigation();
  const conversation = useQuery(api.posts.getConversation, {
    postId: post.postId,
  });
  const targetAvailable =
    conversation === undefined ||
    (conversation._tag === "ok" &&
      [conversation.root, ...conversation.replies].some(
        (entry) => entry._tag === "active" && entry.post.postId === post.postId,
      ));
  const pending = state._tag === "pending";
  const draft = state.draft;
  const remaining = PostContent.remainingCharacters(draft);

  useEffect(() => {
    dialogRef.current?.showModal();
    textareaRef.current?.focus();
  }, []);

  const closeAndRestoreFocus = () => {
    dialogRef.current?.close();
    if (trigger.isConnected) {
      trigger.focus();
    }
    close();
  };

  const submit = async () => {
    if (!targetAvailable) {
      setState({ _tag: "editing", draft, failure: "target-deleted" });
      return;
    }

    if (remaining < 0) {
      setState({ _tag: "editing", draft, failure: "too-long" });
      return;
    }

    setState({ _tag: "pending", draft });
    try {
      const outcome = await createQuote({
        targetPostId: post.postId,
        commentary: draft,
      });
      switch (outcome._tag) {
        case "ok":
          closeAndRestoreFocus();
          return;
        case "invalid-content":
          setState({ _tag: "editing", draft, failure: outcome.reason });
          return;
        case "unauthenticated":
        case "already-reposted":
        case "target-not-found":
        case "target-deleted":
          setState({ _tag: "editing", draft, failure: outcome._tag });
          return;
        case "registration-required":
          onboarding.start();
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setState({ _tag: "editing", draft, failure: "connection" });
    }
  };

  return (
    <dialog
      aria-labelledby={`quote-title-${post.postId}`}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          closeAndRestoreFocus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          closeAndRestoreFocus();
        }
      }}
      ref={dialogRef}
    >
      <form
        className="p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) {
            void submit();
          }
        }}
      >
        <h2 className="text-lg font-semibold" id={`quote-title-${post.postId}`}>
          Quote this Post
        </h2>
        <p className="mt-1 text-body text-muted">
          Add commentary, or leave it blank to Repost.
        </p>
        <QuotedPostPreview
          reference={
            targetAvailable
              ? { _tag: "available", post }
              : { _tag: "unavailable" }
          }
        />
        {!targetAvailable ? (
          <p className="mt-2 text-body text-danger" role="alert">
            This Post was deleted. Your draft is safe, but it can no longer be
            quoted.
          </p>
        ) : null}
        <label className="sr-only" htmlFor={`quote-draft-${post.postId}`}>
          Quote commentary
        </label>
        <textarea
          aria-busy={pending}
          aria-describedby={`quote-counter-${post.postId}`}
          className="mt-4 min-h-28 w-full resize-y rounded-card border border-line bg-surface p-3 font-reading text-reading text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          id={`quote-draft-${post.postId}`}
          onChange={(event) => {
            if (state._tag === "editing") {
              setState({
                _tag: "editing",
                draft: event.target.value,
                failure: null,
              });
            }
          }}
          placeholder="Add your thoughts…"
          readOnly={pending}
          ref={textareaRef}
          rows={4}
          value={draft}
        />
        {state._tag === "editing" && state.failure !== null ? (
          <p className="mt-2 text-body text-danger" role="alert">
            {failureMessage(state.failure)}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p
            className={`text-meta ${remaining < 0 ? "text-danger" : "text-muted"}`}
            id={`quote-counter-${post.postId}`}
          >
            {remaining >= 0
              ? `${remaining} characters left`
              : `${-remaining} characters over`}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="min-h-touch cursor-pointer rounded-pill px-4 text-sm text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-sage disabled:cursor-default disabled:opacity-60"
              disabled={pending}
              onClick={closeAndRestoreFocus}
              type="button"
            >
              Cancel
            </button>
            <button
              className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
              disabled={pending || !targetAvailable}
              type="submit"
            >
              {pending
                ? "Publishing…"
                : draft.trim().length === 0
                  ? "Repost"
                  : "Quote"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

/** Keeps one Quote dialog alive even when its source card updates or unmounts. */
export function QuoteComposerProvider({
  children,
}: QuoteComposerProviderProps) {
  const [selection, setSelection] = useState<QuoteSelection | null>(null);

  return (
    <QuoteComposerContext.Provider
      value={{
        open: (post, trigger) => {
          setSelection({ post, trigger });
        },
      }}
    >
      {children}
      {selection === null ? null : (
        <QuoteComposer
          close={() => {
            setSelection(null);
          }}
          key={selection.post.postId}
          selection={selection}
        />
      )}
    </QuoteComposerContext.Provider>
  );
}

/**
 * Requests authentication, then Member Registration, before opening the shared
 * Quote composer dialog.
 */
export function QuoteAction({ post }: QuoteActionProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const registration = useRegistrationState();
  const onboarding = useOnboardingNavigation();
  const composer = useQuoteComposer();

  if (isLoading || (isAuthenticated && registration._tag === "loading")) {
    return (
      <button className={actionClassName} disabled type="button">
        Quote
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInButton>
        <button
          aria-label="Sign in to Quote this Post."
          className={actionClassName}
          type="button"
        >
          Quote
        </button>
      </SignInButton>
    );
  }

  if (registration._tag === "registration-required") {
    return (
      <button
        aria-label="Finish setting up your Member to Quote this Post."
        className={actionClassName}
        onClick={onboarding.start}
        type="button"
      >
        Quote
      </button>
    );
  }

  return (
    <button
      className={actionClassName}
      onClick={(event) => {
        composer.open(post, event.currentTarget);
      }}
      type="button"
    >
      Quote
    </button>
  );
}
