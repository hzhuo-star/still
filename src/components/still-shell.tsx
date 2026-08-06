import Link from "next/link";
import type { ReactNode } from "react";

type StillShellProps = {
  readonly auth: ReactNode;
  readonly children: ReactNode;
};

/** Renders Still's responsive navigation, reading column, and context rail. */
export function StillShell({ auth, children }: StillShellProps) {
  return (
    <div className="mx-auto grid min-h-screen w-[calc(100%-2rem)] max-w-shell grid-cols-1 shell:grid-cols-[190px_minmax(0,610px)] shell:gap-10 context:grid-cols-[minmax(150px,190px)_minmax(0,610px)_minmax(180px,220px)] context:gap-5 min-[1160px]:gap-layout">
      <a
        className="sr-only z-20 rounded-control bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main-content"
      >
        Skip to Feed
      </a>
      <header className="sticky top-0 z-10 -mx-4 flex min-h-16 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur shell:top-8 shell:mx-0 shell:min-h-0 shell:self-start shell:flex-col shell:items-start shell:gap-8 shell:border-0 shell:bg-transparent shell:px-0 shell:backdrop-blur-none">
        <Link
          className="font-reading text-2xl text-ink no-underline shell:text-3xl"
          href="/"
        >
          Still
        </Link>
        <nav aria-label="Primary navigation" className="hidden shell:block">
          <Link
            aria-current="page"
            className="flex min-h-touch items-center gap-3 text-sm font-medium text-ink no-underline before:h-5 before:w-0.5 before:rounded-pill before:bg-sage"
            href="/"
          >
            Feed
          </Link>
        </nav>
        {auth}
      </header>

      <main
        className="w-full min-w-0 border-x border-line bg-surface px-5 py-10 feed:px-8 shell:min-h-screen shell:py-16"
        id="main-content"
      >
        {children}
      </main>

      <aside aria-labelledby="about-still" className="hidden context:block">
        <div className="sticky top-8 rounded-card bg-sage-soft p-5">
          <h2 className="text-sm font-semibold text-ink" id="about-still">
            About Still
          </h2>
          <p className="mt-3 text-body text-muted">
            A finite public Feed for thoughtful Posts. New activity will update
            live without asking you to keep scrolling.
          </p>
        </div>
      </aside>
    </div>
  );
}
