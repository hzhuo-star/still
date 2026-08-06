type PostListSkeletonProps = {
  /** The announcement for assistive technology, such as “Loading the Feed”. */
  readonly loadingLabel: string;
};

/**
 * Renders quiet Post-shaped placeholders while a reactive Convex
 * subscription delivers its first result.
 */
export function PostListSkeleton({ loadingLabel }: PostListSkeletonProps) {
  return (
    <div>
      <p className="sr-only" role="status">
        {loadingLabel}
      </p>
      {[0, 1, 2].map((row) => (
        <div
          aria-hidden="true"
          className="border-t border-line py-post"
          key={row}
        >
          <div className="flex items-center gap-3">
            <span className="size-8.5 animate-pulse rounded-pill bg-line motion-reduce:animate-none" />
            <span className="h-3 w-28 animate-pulse rounded-pill bg-line motion-reduce:animate-none" />
          </div>
          <div className="mt-4 h-4 w-full animate-pulse rounded-pill bg-line/70 motion-reduce:animate-none" />
          <div className="mt-2 h-4 w-3/5 animate-pulse rounded-pill bg-line/70 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
