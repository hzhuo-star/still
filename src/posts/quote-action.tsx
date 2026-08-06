"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { AuthoredPostView } from "../../convex/contract/post";
import * as PostContent from "../../convex/lib/postContent";
import { casesHandled } from "../../convex/lib/result";
import { QuotedPostPreview } from "@/posts/quoted-post-preview";

type QuoteActionProps = {
  /** The authored Post selected as the Quote target. */
  readonly post: AuthoredPostView;
};

type QuoteFailure =
  | "too-long"
  | "unauthenticated"
  | "already-reposted"
  | "target-not-found"
  | "target-deleted"
  | "connection";

type QuoteComposerState =
  | { readonly _tag: "closed" }
  | {
      readonly _tag: "editing";
      readonly draft: string;
      readonly failure: QuoteFailure | null;
    }
  | { readonly _tag: "pending"; readonly draft: string };

const actionClassName =
  "flex min-h-touch cursor-pointer items-center bg-transparent p-0 text-sm text-muted transition-colors ease-still hover:text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-60";

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

function QuoteComposer({ post }: QuoteActionProps) {
  const [state, setState] = useState<QuoteComposerState>({ _tag: "closed" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createQuote = useMutation(api.posts.createQuote);
  const pending = state._tag === "pending";
  const draft = state._tag === "closed" ? "" : state.draft;
  const remaining = PostContent.remainingCharacters(draft);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (state._tag === "closed") {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
      textareaRef.current?.focus();
    }
  }, [state._tag]);

  const close = () => {
    setState({ _tag: "closed" });
  };

  const submit = async () => {
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
          close();
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
        default:
          casesHandled(outcome);
      }
    } catch {
      setState({ _tag: "editing", draft, failure: "connection" });
    }
  };

  return (
    <>
      <button
        className={actionClassName}
        onClick={() => {
          setState({ _tag: "editing", draft: "", failure: null });
        }}
        ref={triggerRef}
        type="button"
      >
        Quote
      </button>
      <dialog
        aria-labelledby={`quote-title-${post.postId}`}
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) {
            close();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) {
            close();
          }
        }}
        onClose={() => {
          triggerRef.current?.focus();
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
          <h2
            className="text-lg font-semibold"
            id={`quote-title-${post.postId}`}
          >
            Quote this Post
          </h2>
          <p className="mt-1 text-body text-muted">
            Add commentary, or leave it blank to Repost.
          </p>
          <QuotedPostPreview reference={{ _tag: "available", post }} />
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
                onClick={close}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
                disabled={pending}
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
    </>
  );
}

/** Requests authentication before mounting the Quote composer dialog. */
export function QuoteAction(props: QuoteActionProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
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

  return <QuoteComposer {...props} />;
}
