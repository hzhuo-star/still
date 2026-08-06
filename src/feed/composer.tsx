"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import * as PostContent from "../../convex/postContent";
import { casesHandled } from "../../convex/result";

type ComposerFailure = "empty" | "too-long" | "unauthenticated" | "connection";

type ComposerState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "pending" }
  | { readonly _tag: "failed"; readonly reason: ComposerFailure };

function failureMessage(reason: ComposerFailure): string {
  switch (reason) {
    case "empty":
      return "Write something before publishing.";
    case "too-long":
      return `Posts hold at most ${PostContent.MAX_POST_LENGTH} characters. Trim your thought and try again.`;
    case "unauthenticated":
      return "Your session ended. Sign in again to publish.";
    case "connection":
      return "Publishing didn’t reach Still. Your draft is safe — try again.";
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

function ComposerForm() {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<ComposerState>({ _tag: "idle" });
  const createPost = useMutation(api.posts.create);

  const remaining = PostContent.remainingCharacters(draft);
  const pending = state._tag === "pending";

  const submit = async () => {
    const parsed = PostContent.parse(draft);

    if (parsed._tag === "err") {
      setState({ _tag: "failed", reason: parsed.error.reason });
      return;
    }

    setState({ _tag: "pending" });

    try {
      const outcome = await createPost({ content: draft });

      switch (outcome._tag) {
        case "ok":
          setDraft("");
          setState({ _tag: "idle" });
          return;
        case "invalid-content":
          setState({ _tag: "failed", reason: outcome.reason });
          return;
        case "unauthenticated":
          setState({ _tag: "failed", reason: "unauthenticated" });
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setState({ _tag: "failed", reason: "connection" });
    }
  };

  return (
    <form
      aria-label="Write a Post"
      className="rounded-card border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!pending) {
          void submit();
        }
      }}
    >
      <label className="sr-only" htmlFor="composer-draft">
        Write a thought
      </label>
      <textarea
        aria-busy={pending}
        aria-describedby="composer-counter"
        aria-invalid={
          state._tag === "failed" &&
          (state.reason === "empty" || state.reason === "too-long")
        }
        className="min-h-24 w-full resize-y border-0 bg-transparent font-reading text-reading text-ink placeholder:text-muted"
        id="composer-draft"
        onChange={(event) => {
          setDraft(event.target.value);

          if (state._tag === "failed") {
            setState({ _tag: "idle" });
          }
        }}
        placeholder="Leave a thought here…"
        readOnly={pending}
        rows={3}
        value={draft}
      />

      {state._tag === "failed" ? (
        <p className="mt-1 text-body text-danger" role="alert">
          {failureMessage(state.reason)}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p
          className={`text-meta ${remaining < 0 ? "font-medium text-danger" : "text-muted"}`}
          id="composer-counter"
        >
          {remaining >= 0
            ? `${remaining} characters left`
            : `${-remaining} characters over`}
        </p>
        <p className="sr-only" role="status">
          {counterAnnouncement(remaining)}
        </p>
        <button
          className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-70"
          disabled={pending}
          type="submit"
        >
          {pending ? "Publishing…" : "Publish"}
        </button>
      </div>
    </form>
  );
}

function SignInInvite() {
  return (
    <section
      aria-label="Sign in to participate"
      className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5"
    >
      <div>
        <h2 className="text-body font-medium text-ink">
          Read freely. Sign in to write.
        </h2>
        <p className="mt-1 text-meta text-muted">
          Publishing and Liking need a preview account.
        </p>
      </div>
      <SignInButton>
        <button
          className="min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          type="button"
        >
          Sign in
        </button>
      </SignInButton>
    </section>
  );
}

/**
 * The Feed's publishing area: an accessible composer with a live character
 * counter for signed-in Members, or a quiet sign-in path for visitors.
 */
export function Composer() {
  return (
    <>
      <Show when="signed-in">
        <ComposerForm />
      </Show>
      <Show when="signed-out">
        <SignInInvite />
      </Show>
    </>
  );
}
