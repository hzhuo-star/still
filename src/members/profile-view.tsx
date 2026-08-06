"use client";

import { useQuery } from "convex/react";
import Link from "next/link";

import { api } from "../../convex/_generated/api";
import { MemberAvatar } from "@/members/member-avatar";
import { ListEndingNotice } from "@/posts/list-ending";
import { PostCard } from "@/posts/post-card";
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
        className="mt-6 inline-flex min-h-touch items-center text-sm font-medium text-sage no-underline hover:underline"
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

  return (
    <>
      <ul className="m-0 list-none p-0">
        {outcome.posts.map((post) => (
          <li key={post.postId}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
      <ListEndingNotice ending={outcome.ending} />
    </>
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
      <header className="flex items-center gap-4">
        <MemberAvatar
          avatarUrl={profile.profile.avatarUrl}
          displayName={profile.profile.displayName}
          sizePx={56}
        />
        <div className="min-w-0">
          <h1 className="truncate font-reading text-title text-ink">
            {profile.profile.displayName}
          </h1>
          <p className="text-meta text-muted">Member Profile</p>
        </div>
      </header>
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
