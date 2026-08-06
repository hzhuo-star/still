"use client";

import { Component, type ReactNode } from "react";

type QueryBoundaryProps = {
  /** A short name for the reactive region, such as “the Feed”. */
  readonly regionLabel: string;
  readonly children: ReactNode;
};

type QueryBoundaryState = {
  readonly failed: boolean;
};

/**
 * Catches a failed reactive Convex subscription below it and offers an
 * inline retry that re-subscribes by remounting the region.
 */
export class QueryBoundary extends Component<
  QueryBoundaryProps,
  QueryBoundaryState
> {
  /** Initial, healthy boundary state. */
  override state: QueryBoundaryState = { failed: false };

  /** Enter the failed state when a descendant read throws. */
  static getDerivedStateFromError(): QueryBoundaryState {
    return { failed: true };
  }

  /** Render the region, or an inline retry card after a failure. */
  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <section
        aria-live="polite"
        className="mt-8 rounded-card border border-danger/20 bg-danger-soft p-5"
      >
        <h2 className="text-body font-semibold text-danger">
          {`Still could not load ${this.props.regionLabel}.`}
        </h2>
        <p className="mt-2 text-body text-ink">
          The live connection hit a temporary problem.
        </p>
        <button
          className="mt-4 min-h-touch cursor-pointer rounded-pill bg-sage px-4 text-sm font-medium text-white transition-colors ease-still hover:bg-sage-hover focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          onClick={() => {
            this.setState({ failed: false });
          }}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }
}
