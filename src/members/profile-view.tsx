"use client";

import { useQuery } from "convex/react";
import Link from "next/link";

import { api } from "../../convex/_generated/api";
import { FollowButton } from "@/members/follow-button";
import { MemberAvatar } from "@/members/member-avatar";
import { PostList } from "@/posts/post-list";
import { PostListSkeleton } from "@/posts/post-list-skeleton";

function ProfileSkeleton() {
  return (
    <div>
      <p className="sr-only" role="status">
        Loading this Profile
      </p>
      <div aria-hidden="true" className="flex items-center gap-4">
        <span className="size-14 animate-pulse rounded-pill bg-line motion-reduce:animate-none" />
        <span className="h-6 w-44 animate-pulse rounded-pill bg-line motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function ProfileNotFound() {
  return (
    <section aria-labelledby="profile-not-found">
      <h1 className="font-reading text-title text-ink" id="profile-not-found">
        This Member doesn’t exist.
      </h1>
      <p className="mt-3 text-body text-muted">
        The Profile may have been removed, or the address may be mistyped.
      </p>
      <Link
        className="mt-6 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href="/"
      >
        Back to the Feed
      </Link>
    </section>
  );
}

function MemberPosts({
  displayName,
  memberId,
}: {
  readonly displayName: string;
  readonly memberId: string;
}) {
  const outcome = useQuery(api.posts.listByMember, { memberId });

  if (outcome === undefined) {
    return (
      <PostListSkeleton loadingLabel={`Loading Posts by ${displayName}`} />
    );
  }

  if (outcome._tag === "member-not-found") {
    return <ProfileNotFound />;
  }

  if (outcome.posts.length === 0) {
    return (
      <section className="border-t border-line py-10">
        <h2 className="font-reading text-2xl text-ink">No Posts yet.</h2>
        <p className="mt-3 text-body text-muted">
          {`When ${displayName} publishes, their thoughts will appear here live.`}
        </p>
      </section>
    );
  }

  return <PostList ending={outcome.ending} posts={outcome.posts} />;
}

function RelationshipCounts({
  followerCount,
  followingCount,
  memberId,
}: {
  readonly followerCount: number;
  readonly followingCount: number;
  readonly memberId: string;
}) {
  const countClassName =
    "inline-flex min-h-touch items-center text-meta text-muted no-underline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return (
    <nav aria-label="Relationships" className="mt-4 flex items-center gap-6">
      <Link className={countClassName} href={`/members/${memberId}/followers`}>
        <span className="font-medium text-ink">{followerCount}</span>
        &nbsp;
        {followerCount === 1 ? "Follower" : "Followers"}
      </Link>
      <Link className={countClassName} href={`/members/${memberId}/following`}>
        <span className="font-medium text-ink">{followingCount}</span>
        &nbsp;Following
      </Link>
    </nav>
  );
}

type ProfileViewProps = {
  /** The untrusted Member id segment from the Profile route. */
  readonly memberId: string;
};

/**
 * A Member's public, read-only Profile: their current projected identity
 * and their Posts, with local reactive loading and not-found states.
 */
export function ProfileView({ memberId }: ProfileViewProps) {
  const profile = useQuery(api.members.getProfile, { memberId });

  if (profile === undefined) {
    return <ProfileSkeleton />;
  }

  if (profile._tag === "member-not-found") {
    return <ProfileNotFound />;
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <MemberAvatar
          avatarUrl={profile.profile.avatarUrl}
          displayName={profile.profile.displayName}
          sizePx={56}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-reading text-title text-ink">
            {profile.profile.displayName}
          </h1>
          <p className="truncate text-meta text-muted">
            {profile.profile.registrationState === "registered"
              ? `@${profile.profile.handle}`
              : "Member Profile"}
          </p>
        </div>
        <FollowButton
          displayName={profile.profile.displayName}
          memberId={profile.profile.memberId}
          viewerFollow={profile.viewerFollow}
        />
      </header>
      <RelationshipCounts
        followerCount={profile.profile.followerCount}
        followingCount={profile.profile.followingCount}
        memberId={memberId}
      />
      {profile.profile.registrationState === "registered" &&
      profile.profile.biography !== undefined ? (
        <p className="mt-4 text-body text-ink">{profile.profile.biography}</p>
      ) : null}
      <section
        aria-label={`Posts by ${profile.profile.displayName}`}
        className="mt-10"
      >
        <MemberPosts
          displayName={profile.profile.displayName}
          memberId={memberId}
        />
      </section>
    </>
  );
}
