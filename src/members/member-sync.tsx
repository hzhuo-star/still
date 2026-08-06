"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "../../convex/_generated/api";

/**
 * Idempotently projects the signed-in Clerk identity into a Member once the
 * Convex connection is authenticated. Renders nothing.
 */
export function MemberSync() {
  const { isAuthenticated } = useConvexAuth();
  const ensureCurrent = useMutation(api.members.ensureCurrent);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // A failed refresh is safe to ignore: every write re-runs the same
    // idempotent projection before acting.
    ensureCurrent({}).catch(() => undefined);
  }, [isAuthenticated, ensureCurrent]);

  return null;
}
