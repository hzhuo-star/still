"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AuthoredPostView } from "../../convex/contract/post";
import * as PostContent from "../../convex/lib/postContent";
import { casesHandled } from "../../convex/lib/result";

type ReplyComposerProps = {
  /** The active authored Post selected as the direct parent. */
  readonly target: AuthoredPostView;
  /** Whether navigation requested that the textarea receive focus. */
  readonly initiallyOpen: boolean;
  /** Monotonic request used when an already-current Reply link is activated. */
  readonly openRequest: number;
  /** Whether the selected target disappeared while this composer was open. */
  readonly targetUnavailable?: boolean;
};

type ReplyNavigationContextValue = {
  readonly postId: Id<"posts">;
  readonly requestOpen: () => void;
};

const ReplyNavigationContext =
  createContext<ReplyNavigationContextValue | null>(null);

/** Makes same-URL Reply actions reopen the mounted contextual composer. */
export function ReplyNavigationProvider({
  children,
  postId,
  requestOpen,
}: ReplyNavigationContextValue & { readonly children: ReactNode }) {
  return (
    <ReplyNavigationContext.Provider value={{ postId, requestOpen }}>
      {children}
    </ReplyNavigationContext.Provider>
  );
}

/** Returns the current Conversation's local Reply navigation controller. */
export function useReplyNavigation(): ReplyNavigationContextValue | null {
  return useContext(ReplyNavigationContext);
}

type ReplyFailure =
  | PostContent.InvalidPostContentReason
  | "unauthenticated"
  | "target-not-found"
  | "target-deleted"
  | "connection";

type ReplyComposerState =
  | { readonly _tag: "closed" }
  | {
      readonly _tag: "editing";
      readonly draft: string;
      readonly failure: ReplyFailure | null;
    }
  | { readonly _tag: "pending"; readonly draft: string };

function failureMessage(reason: ReplyFailure): string {
  switch (reason) {
    case "empty":
      return "Write something before publishing your Reply.";
    case "too-long":
      return `Replies hold at most ${PostContent.MAX_POST_LENGTH} characters.`;
    case "unauthenticated":
      return "Your session ended. Sign in again to Reply.";
    case "target-not-found":
      return "This Post is no longer available.";
    case "target-deleted":
      return "This Post was deleted and can no longer receive Replies.";
    case "connection":
      return "Your Reply didn’t reach Still. Your draft is safe — try again.";
    default:
      return casesHandled(reason);
  }
}

function counterAnnouncement(remaining: number): string {
  if (remaining < 0) {
    return `Over the ${PostContent.MAX_POST_LENGTH} character limit.`;
  }
  if (remaining <= 20 && remaining % 10 === 0) {
    return `${remaining} characters left.`;
  }
  return "";
}

function SignedOutReplyInvite() {
  return (
    <section className="rounded-card border border-line p-5">
      <p className="text-body text-muted">Sign in to join this Conversation.</p>
      <SignInButton>
        <button
          className="mt-3 min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
          type="button"
        >
          Sign in to Reply
        </button>
      </SignInButton>
    </section>
  );
}

function ReplyForm({
  target,
  initiallyOpen,
  openRequest,
  targetUnavailable = false,
}: ReplyComposerProps) {
  const [state, setState] = useState<ReplyComposerState>(
    initiallyOpen
      ? { _tag: "editing", draft: "", failure: null }
      : { _tag: "closed" },
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previouslyRequestedOpen = useRef(initiallyOpen);
  const previousOpenRequest = useRef(openRequest);
  const createReply = useMutation(api.posts.createReply);
  const pending = state._tag === "pending";
  const draft = state._tag === "closed" ? "" : state.draft;
  const remaining = PostContent.remainingCharacters(draft);

  useEffect(() => {
    if (state._tag === "editing") {
      textareaRef.current?.focus();
    }
  }, [state._tag]);

  useEffect(() => {
    const navigationRequestedOpen =
      (initiallyOpen && !previouslyRequestedOpen.current) ||
      openRequest !== previousOpenRequest.current;
    previouslyRequestedOpen.current = initiallyOpen;
    previousOpenRequest.current = openRequest;

    if (navigationRequestedOpen) {
      setState((current) =>
        current._tag === "closed"
          ? { _tag: "editing", draft: "", failure: null }
          : current,
      );
    }
  }, [initiallyOpen, openRequest]);

  if (state._tag === "closed") {
    if (targetUnavailable) {
      return null;
    }

    return (
      <button
        className="min-h-touch cursor-pointer rounded-pill border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-sage focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
        onClick={() => {
          setState({ _tag: "editing", draft: "", failure: null });
        }}
        type="button"
      >
        Write a Reply
      </button>
    );
  }

  const submit = async () => {
    if (targetUnavailable) {
      setState({ _tag: "editing", draft, failure: "target-deleted" });
      return;
    }

    const parsed = PostContent.parse(draft);
    if (parsed._tag === "err") {
      setState({
        _tag: "editing",
        draft,
        failure: parsed.error.reason,
      });
      return;
    }

    setState({ _tag: "pending", draft });
    try {
      const outcome = await createReply({
        parentPostId: target.postId,
        content: parsed.value,
      });
      switch (outcome._tag) {
        case "ok":
          setState({ _tag: "closed" });
          return;
        case "invalid-content":
          setState({ _tag: "editing", draft, failure: outcome.reason });
          return;
        case "unauthenticated":
        case "target-not-found":
        case "target-deleted":
          setState({ _tag: "editing", draft, failure: outcome._tag });
          return;
        case "target-is-repost":
          setState({
            _tag: "editing",
            draft,
            failure: "target-not-found",
          });
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setState({ _tag: "editing", draft, failure: "connection" });
    }
  };

  return (
    <form
      aria-label={`Reply to ${target.author.displayName}`}
      className="rounded-card border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) {
          void submit();
        }
      }}
    >
      <p className="mb-2 text-meta text-muted">
        {`Replying to ${target.author.displayName}`}
      </p>
      <label className="sr-only" htmlFor={`reply-draft-${target.postId}`}>
        Write a Reply
      </label>
      <textarea
        aria-busy={pending}
        aria-describedby={`reply-counter-${target.postId}`}
        className="min-h-24 w-full resize-y border-0 bg-transparent font-reading text-reading text-ink placeholder:text-muted focus-visible:outline-none"
        id={`reply-draft-${target.postId}`}
        onChange={(event) => {
          if (state._tag === "editing") {
            setState({
              _tag: "editing",
              draft: event.target.value,
              failure: null,
            });
          }
        }}
        placeholder="Leave a Reply…"
        readOnly={pending}
        ref={textareaRef}
        rows={3}
        value={draft}
      />
      {state._tag === "editing" && state.failure !== null ? (
        <p className="mt-1 text-body text-danger" role="alert">
          {failureMessage(state.failure)}
        </p>
      ) : null}
      {state._tag === "editing" &&
      state.failure === null &&
      targetUnavailable ? (
        <p className="mt-1 text-body text-danger" role="alert">
          This Post was deleted. Your draft is safe, but it can no longer
          receive Replies.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p
          className={`text-meta ${remaining < 0 ? "text-danger" : "text-muted"}`}
          id={`reply-counter-${target.postId}`}
        >
          {remaining >= 0
            ? `${remaining} characters left`
            : `${-remaining} characters over`}
        </p>
        <p className="sr-only" role="status">
          {counterAnnouncement(remaining)}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="min-h-touch cursor-pointer rounded-pill px-4 text-sm text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-sage disabled:cursor-default disabled:opacity-60"
            disabled={pending}
            onClick={() => {
              setState({ _tag: "closed" });
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
            disabled={pending || targetUnavailable}
            type="submit"
          >
            {pending ? "Publishing…" : "Reply"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Renders the contextual pessimistic Reply composer, requesting sign-in
 * before mounting a draft for visitors.
 */
export function ReplyComposer(props: ReplyComposerProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return <p className="text-meta text-muted">Preparing the composer…</p>;
  }
  return isAuthenticated ? <ReplyForm {...props} /> : <SignedOutReplyInvite />;
}
