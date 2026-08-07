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
  /**
   * The untrusted route segment this Profile was queried with, so optimistic
   * feedback lands on the exact query the page is reading.
   */
  readonly routeMemberId: string;
  /** The Member's display name, for accessible labels. */
  readonly displayName: string;
  /** The viewer's authoritative relationship to that Member. */
  readonly viewerFollow: ViewerFollow;
};

const buttonClassName =
  "min-h-touch cursor-pointer rounded-pill px-4 text-sm font-medium transition-colors ease-still focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-default disabled:opacity-70";

function FollowControl({
  memberId,
  routeMemberId,
  displayName,
  viewerFollow,
}: FollowButtonProps) {
  // The optimistic update rewrites the Profile query this page is already
  // reading — Follow state and follower count together — and Convex rolls it
  // back the moment the authoritative outcome lands, so a refused request
  // reverts by itself and another session's changes are never masked.
  const setFollow = useMutation(api.members.setFollow).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.members.getProfile, {
        memberId: routeMemberId,
      });

      if (current === undefined || current._tag !== "ok") {
        return;
      }

      const delta = args.intent === "follow" ? 1 : -1;

      localStore.setQuery(
        api.members.getProfile,
        { memberId: routeMemberId },
        {
          ...current,
          viewerFollow:
            args.intent === "follow" ? "following" : "not-following",
          profile: {
            ...current.profile,
            followerCount: Math.max(0, current.profile.followerCount + delta),
          },
        },
      );
    },
  );
  const onboarding = useOnboardingNavigation();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const following = viewerFollow === "following";

  const onPress = async () => {
    setPending(true);
    setFeedback(null);

    try {
      const outcome = await setFollow({
        memberId,
        intent: following ? "unfollow" : "follow",
      });

      switch (outcome._tag) {
        case "ok":
          return;
        case "unauthenticated":
          setFeedback("Your session ended. Sign in again to Follow.");
          return;
        case "registration-required":
          onboarding.start();
          return;
        case "self-follow":
          setFeedback("You cannot Follow yourself.");
          return;
        case "member-not-found":
          setFeedback("This Member is no longer available.");
          return;
        case "member-not-registered":
          setFeedback("This Member has not finished setting up yet.");
          return;
        case "follow-limit-reached":
          setFeedback(
            `You already Follow ${MAX_FOLLOWING} Members. Unfollow someone to make room.`,
          );
          return;
        default:
          casesHandled(outcome);
      }
    } catch {
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
          void onPress();
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
 * control at all. A press shows its Follow state and follower count
 * optimistically and rolls back with accessible feedback when the authoritative
 * outcome refuses it.
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
