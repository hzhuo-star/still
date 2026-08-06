"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { casesHandled } from "../../convex/lib/result";

type RemoveRepostButtonProps = {
  /** The current Member's Repost wrapper to remove. */
  readonly repostId: Id<"posts">;
};

/** Removes the current Member's Repost wrapper with pending and retry states. */
export function RemoveRepostButton({ repostId }: RemoveRepostButtonProps) {
  const removePost = useMutation(api.posts.remove);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const onRemove = async () => {
    setPending(true);
    setFeedback(null);

    try {
      const outcome = await removePost({ postId: repostId });
      switch (outcome._tag) {
        case "ok":
        case "post-not-found":
          return;
        case "forbidden":
          setFeedback("Only the reposter can remove this Repost.");
          return;
        case "unauthenticated":
          setFeedback(
            "Your session ended. Sign in again to remove this Repost.",
          );
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setFeedback("Removal didn’t reach Still. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        className="flex min-h-touch cursor-pointer items-center bg-transparent p-0 text-sm text-muted transition-colors ease-still hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:text-muted"
        disabled={pending}
        onClick={() => {
          void onRemove();
        }}
        type="button"
      >
        {pending ? "Removing Repost…" : "Remove Repost"}
      </button>
      {feedback === null ? null : (
        <p className="basis-full text-meta text-danger" role="alert">
          {feedback}
        </p>
      )}
    </>
  );
}
