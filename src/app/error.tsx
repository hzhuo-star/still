"use client";

/** Renders a recoverable route failure without exposing internal details. */
export default function ErrorPage({ reset }: { readonly reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-feed items-center px-5">
      <section
        aria-labelledby="error-title"
        className="w-full rounded-card border border-danger/20 bg-danger-soft p-6"
      >
        <p className="text-label font-semibold tracking-wider text-danger uppercase">
          Something went wrong
        </p>
        <h1 className="mt-2 font-reading text-2xl text-ink" id="error-title">
          Still could not load this view
        </h1>
        <p className="mt-3 text-body text-ink">
          The preview connection may be temporarily unavailable.
        </p>
        <button
          className="mt-5 min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white hover:bg-sage-hover"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
