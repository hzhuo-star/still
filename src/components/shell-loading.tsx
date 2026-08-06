import { StillShell } from "@/components/still-shell";

/** Renders the static Still shell while provider-backed content becomes ready. */
export function ShellLoading() {
  return (
    <StillShell
      activeRoute="none"
      auth={
        <span className="block h-10 w-20 animate-pulse rounded-pill bg-line motion-reduce:animate-none" />
      }
    >
      <p className="text-label font-semibold tracking-[0.14em] text-sage uppercase">
        Team preview
      </p>
      <div className="mt-4 h-10 w-4/5 animate-pulse rounded-card bg-line motion-reduce:animate-none" />
      <div className="mt-4 h-20 animate-pulse rounded-card bg-line/70 motion-reduce:animate-none" />
      <p className="sr-only">Loading Still</p>
    </StillShell>
  );
}
