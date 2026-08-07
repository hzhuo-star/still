"use client";

import { useQuery } from "convex/react";
import Link from "next/link";

import { api } from "../../convex/_generated/api";
import { RELATIONSHIP_LIMIT } from "../../convex/contract/member";
import { MemberAvatar } from "@/members/member-avatar";

/** Which direction of one Member's Follow relationships a route renders. */
export type RelationshipDirection = "followers" | "following";

type RelationshipListProps = {
  /** The untrusted Member id segment from the relationship route. */
  readonly memberId: string;
  /** Which side of the Follow graph to render. */
  readonly direction: RelationshipDirection;
};

function heading(direction: RelationshipDirection): string {
  return direction === "followers" ? "Followers" : "Following";
}

function emptyMessage(direction: RelationshipDirection): string {
  return direction === "followers"
    ? "No one Follows this Member yet."
    : "This Member does not Follow anyone yet.";
}

function endingMessage(direction: RelationshipDirection): string {
  return direction === "followers"
    ? `Showing the newest ${RELATIONSHIP_LIMIT} Followers`
    : `Showing the newest ${RELATIONSHIP_LIMIT} Members`;
}

/**
 * One Member's public follower or following list: current Member summaries,
 * newest relationship first, bounded with honest ending copy.
 */
export function RelationshipList({
  memberId,
  direction,
}: RelationshipListProps) {
  const outcome = useQuery(
    direction === "followers"
      ? api.members.listFollowers
      : api.members.listFollowing,
    { memberId },
  );

  return (
    <>
      <h1
        className="font-reading text-title text-ink"
        id="relationship-list-title"
      >
        {heading(direction)}
      </h1>

      {outcome === undefined ? (
        <p className="mt-8 text-body text-muted" role="status">
          {`Loading ${heading(direction)}…`}
        </p>
      ) : outcome._tag === "member-not-found" ? (
        <>
          <p className="mt-4 text-body text-muted">
            This Member doesn’t exist. The Profile may have been removed, or the
            address may be mistyped.
          </p>
          <Link
            className="mt-6 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/"
          >
            Back to the Feed
          </Link>
        </>
      ) : outcome.members.length === 0 ? (
        <p className="mt-8 text-body text-muted">{emptyMessage(direction)}</p>
      ) : (
        <>
          <ul className="mt-6 list-none p-0">
            {outcome.members.map((member) => (
              <li
                className="flex items-center gap-3 border-t border-line py-4"
                key={member.memberId}
              >
                <MemberAvatar
                  avatarUrl={member.avatarUrl}
                  displayName={member.displayName}
                  sizePx={34}
                />
                <Link
                  className="min-w-0 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href={`/members/${member.memberId}`}
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {member.displayName}
                  </span>
                  <span className="block truncate text-meta text-muted">
                    {`@${member.handle}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-line py-6 text-meta text-muted">
            {outcome.ending === "complete"
              ? "You’re at the end"
              : endingMessage(direction)}
          </p>
          <Link
            className="inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href={`/members/${memberId}`}
          >
            Back to this Profile
          </Link>
        </>
      )}
    </>
  );
}
