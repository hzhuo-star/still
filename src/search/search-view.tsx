"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { api } from "../../convex/_generated/api";
import type { MemberSummary } from "../../convex/contract/member";
import { SEARCH_LIMIT } from "../../convex/contract/search";
import { MemberAvatar } from "@/members/member-avatar";
import { PostList } from "@/posts/post-list";

/** Which result type the Search surface is presenting. */
type SearchTab = "posts" | "members";

function parseTab(raw: string | null): SearchTab {
  return raw === "members" ? "members" : "posts";
}

function tabHref(tab: SearchTab, searchQuery: string): string {
  const params = new URLSearchParams({ tab });
  if (searchQuery.length > 0) {
    params.set("q", searchQuery);
  }
  return `/search?${params.toString()}`;
}

const tabLinkClassName = (isCurrent: boolean): string =>
  `flex min-h-touch flex-1 items-center justify-center border-b-2 text-sm font-medium no-underline transition-colors ease-still ${
    isCurrent
      ? "border-sage text-ink"
      : "border-transparent text-muted hover:text-ink"
  }`;

function InitialState() {
  return (
    <section className="border-t border-line py-10">
      <h2 className="font-reading text-2xl text-ink">Search Still.</h2>
      <p className="mt-3 text-body text-muted">
        Find Posts by their current words, or Members by Handle and display
        name. Results stay live as Still changes — nothing trends here.
      </p>
      <p className="mt-2 text-meta text-muted">
        Search understands Latin-script words best; other scripts match whole
        words only.
      </p>
    </section>
  );
}

function MemberResults({
  members,
  ending,
}: {
  readonly members: ReadonlyArray<MemberSummary>;
  readonly ending: "complete" | "truncated";
}) {
  return (
    <>
      <ul className="m-0 list-none p-0">
        {members.map((member) => (
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
      <p className="border-t border-line py-8 text-center text-sm text-muted">
        {ending === "complete"
          ? "You’re caught up."
          : `Showing the first ${SEARCH_LIMIT} matches.`}
      </p>
    </>
  );
}

function NoResults({
  tab,
  searchQuery,
}: {
  readonly tab: SearchTab;
  readonly searchQuery: string;
}) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="font-reading text-2xl text-ink">
        {tab === "posts"
          ? `No Posts match “${searchQuery}”.`
          : `No Members match “${searchQuery}”.`}
      </h2>
      <p className="mt-3 text-body text-muted">
        {tab === "posts"
          ? "Search reads only the current wording of active Posts. Try fewer or different words."
          : "Search reads current Handles and display names, never biographies. Try a different name."}
      </p>
    </section>
  );
}

/**
 * The public Search surface: one accessible GET form whose trimmed query and
 * selected tab live in the URL — surviving refresh, sharing, and history —
 * with reactive bounded Posts and Members results. The results heading takes
 * focus only after an explicit submission or tab change, never during a
 * reactive refresh.
 */
export function SearchView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchQuery = (searchParams.get("q") ?? "").trim();
  const tab = parseTab(searchParams.get("tab"));

  const postsOutcome = useQuery(
    api.search.posts,
    tab === "posts" ? { query: searchQuery } : "skip",
  );
  const membersOutcome = useQuery(
    api.search.members,
    tab === "members" ? { query: searchQuery } : "skip",
  );
  const outcome = tab === "posts" ? postsOutcome : membersOutcome;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const arrivedAt = useRef<{
    readonly searchQuery: string;
    readonly tab: SearchTab;
  } | null>(null);

  // Focus follows explicit navigation — a submission or a tab change — and
  // ignores both the initial arrival and reactive result refreshes.
  useEffect(() => {
    if (arrivedAt.current === null) {
      arrivedAt.current = { searchQuery, tab };
      return;
    }
    if (
      arrivedAt.current.searchQuery === searchQuery &&
      arrivedAt.current.tab === tab
    ) {
      return;
    }
    arrivedAt.current = { searchQuery, tab };
    if (searchQuery.length > 0) {
      headingRef.current?.focus();
    }
  }, [searchQuery, tab]);

  return (
    <>
      <form
        action="/search"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("q");
          const draft = field instanceof HTMLInputElement ? field.value : "";
          router.push(tabHref(tab, draft.trim()));
        }}
        role="search"
      >
        <label className="sr-only" htmlFor="search-query">
          Search Still
        </label>
        <div className="flex gap-2">
          <input
            autoComplete="off"
            className="min-h-touch w-full rounded-control border border-line bg-surface px-3 text-body text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            defaultValue={searchQuery}
            id="search-query"
            key={searchQuery}
            name="q"
            placeholder="Search Posts and Members"
            type="search"
          />
          <button
            className="min-h-touch cursor-pointer rounded-pill bg-sage px-5 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            type="submit"
          >
            Search
          </button>
        </div>
        <input name="tab" type="hidden" value={tab} />
      </form>

      <nav
        aria-label="Search result types"
        className="mt-6 flex border-b border-line"
      >
        <Link
          aria-current={tab === "posts" ? "page" : undefined}
          className={tabLinkClassName(tab === "posts")}
          href={tabHref("posts", searchQuery)}
        >
          Posts
        </Link>
        <Link
          aria-current={tab === "members" ? "page" : undefined}
          className={tabLinkClassName(tab === "members")}
          href={tabHref("members", searchQuery)}
        >
          Members
        </Link>
      </nav>

      <h2 className="sr-only" ref={headingRef} tabIndex={-1}>
        {searchQuery.length === 0
          ? "Search results"
          : `${tab === "posts" ? "Posts" : "Members"} matching “${searchQuery}”`}
      </h2>

      <div className="mt-2">
        {outcome === undefined && searchQuery.length === 0 ? (
          <InitialState />
        ) : outcome === undefined ? (
          <p className="mt-8 text-body text-muted" role="status">
            Searching…
          </p>
        ) : outcome._tag === "empty-query" ? (
          <InitialState />
        ) : tab === "posts" &&
          postsOutcome !== undefined &&
          postsOutcome._tag === "ok" ? (
          postsOutcome.posts.length === 0 ? (
            <NoResults searchQuery={searchQuery} tab={tab} />
          ) : (
            <PostList
              ending={postsOutcome.ending}
              posts={postsOutcome.posts}
              truncatedNotice={`Showing the first ${SEARCH_LIMIT} matches.`}
            />
          )
        ) : membersOutcome !== undefined && membersOutcome._tag === "ok" ? (
          membersOutcome.members.length === 0 ? (
            <NoResults searchQuery={searchQuery} tab={tab} />
          ) : (
            <MemberResults
              ending={membersOutcome.ending}
              members={membersOutcome.members}
            />
          )
        ) : null}
      </div>
    </>
  );
}
