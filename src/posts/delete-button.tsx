"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { casesHandled } from "../../convex/lib/result";

type DeleteButtonProps = {
  /** The Post this control deletes; shown only to its author. */
  readonly postId: Id<"posts">;
};

type DeleteState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "pending" }
  | { readonly _tag: "failed"; readonly message: string };

/**
 * Deletes the viewer's own Post pessimistically: the click enters a visible
 * pending state, the Post stays visible until the backend confirms, and a
 * failure leaves the Post in place with inline retryable feedback.
 */
export function DeleteButton({ postId }: DeleteButtonProps) {
  const [state, setState] = useState<DeleteState>({ _tag: "idle" });
  const removePost = useMutation(api.posts.remove);

  const onDelete = async () => {
    setState({ _tag: "pending" });

    try {
      const outcome = await removePost({ postId });

      switch (outcome._tag) {
        case "ok":
        case "post-not-found":
          // The reactive subscription removes the Post; stay pending until
          // this control unmounts with it.
          return;
        case "forbidden":
          setState({
            _tag: "failed",
            message: "Only the author can delete a Post.",
          });
          return;
        case "unauthenticated":
          setState({
            _tag: "failed",
            message: "Your session ended. Sign in again to delete.",
          });
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setState({
        _tag: "failed",
        message: "Deletion didn’t reach Still. Try again.",
      });
    }
  };

  const pending = state._tag === "pending";

  return (
    <>
      <button
        className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center bg-transparent p-0 text-sm text-muted transition-colors ease-still hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:text-muted"
        disabled={pending}
        onClick={() => {
          void onDelete();
        }}
        type="button"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state._tag === "failed" ? (
        <p className="basis-full text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </>
  );
}
