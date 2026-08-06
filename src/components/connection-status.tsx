"use client";

import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";

/** Shows the live result of the public Convex deployment status query. */
export function ConnectionStatus() {
  const status = useQuery(api.status.get);

  if (status === undefined) {
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted"
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-line" />
        Connecting to Convex…
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-sage" />
      Convex connection ready
    </p>
  );
}
