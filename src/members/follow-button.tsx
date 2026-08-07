"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MAX_FOLLOWING, type ViewerFollow } from "../../convex/contract/member";
import { casesHandled } from "../../convex/lib/result";
import { useOnboardingNavigation } from "@/members/registration";

type FollowButtonProps = {
  /** The Member this control follows or unfollows. */
  readonly memberId: Id<"members">;
  /** The Member's display name, for accessible labels. */
  readonly displayName: string;
  /** The viewer's authoritative relationship to that Member. */
  readonly viewerFollow: ViewerFollow;
};

const buttonClassName =
  "min-h-touch cursor-pointer rounded-pill px-4 text-sm font-medium transition-colors ease-still focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-70";

function FollowControl({
  memberId,
  displayName,
  viewerFollow,
}: FollowButtonProps) {
  const toggleFollow = useMutation(api.members.toggleFollow);
  const onboarding = useOnboardingNavigation();
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<ViewerFollow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // The authoritative value wins as soon as it reflects the change.
  const shown = optimistic ?? viewerFollow;
  const following = shown === "following";

  const onToggle = async () => {
    setPending(true);
    setFeedback(null);
    setOptimistic(following ? "not-following" : "following");

    try {
      const outcome = await toggleFollow({ memberId });

      switch (outcome._tag) {
        case "ok":
          setOptimistic(
            outcome.state === "following" ? "following" : "not-following",
          );
          return;
        case "unauthenticated":
          setOptimistic(null);
          setFeedback("Your session ended. Sign in again to Follow.");
          return;
        case "registration-required":
          setOptimistic(null);
          onboarding.start();
          return;
        case "self-follow":
          setOptimistic(null);
          setFeedback("You cannot Follow yourself.");
          return;
        case "member-not-found":
          setOptimistic(null);
          setFeedback("This Member is no longer available.");
          return;
        case "member-not-registered":
          setOptimistic(null);
          setFeedback("This Member has not finished setting up yet.");
          return;
        case "follow-limit-reached":
          setOptimistic(null);
          setFeedback(
            `You already Follow ${MAX_FOLLOWING} Members. Unfollow someone to make room.`,
          );
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
      setOptimistic(null);
      setFeedback("Your Follow didn’t reach Still. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        aria-label={
          following ? `Unfollow ${displayName}` : `Follow ${displayName}`
        }
        aria-pressed={following}
        className={`${buttonClassName} ${
          following
            ? "border border-line bg-surface text-ink hover:border-sage"
            : "bg-sage text-white hover:bg-sage-hover"
        }`}
        disabled={pending}
        onClick={() => {
          void onToggle();
        }}
        type="button"
      >
        {pending ? "Updating…" : following ? "Following" : "Follow"}
      </button>
      {feedback === null ? null : (
        <p className="mt-2 basis-full text-meta text-danger" role="alert">
          {feedback}
        </p>
      )}
    </>
  );
}

/**
 * The Follow control on a public Profile.
 *
 * A visitor is asked to sign in, an identity awaiting onboarding is sent there
 * by the mutation's precise refusal, and the Member's own Profile shows no
 * control at all.
 */
export function FollowButton(props: FollowButtonProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (props.viewerFollow === "self") {
    return null;
  }

  if (isLoading) {
    return (
      <button
        className={`${buttonClassName} border border-line bg-surface text-muted`}
        disabled
        type="button"
      >
        Follow
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInButton>
        <button
          aria-label={`Sign in to Follow ${props.displayName}`}
          className={`${buttonClassName} bg-sage text-white hover:bg-sage-hover`}
          type="button"
        >
          Follow
        </button>
      </SignInButton>
    );
  }

  return <FollowControl {...props} />;
}
