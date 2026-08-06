import { v } from "convex/values";

import { query } from "./_generated/server";

/** Reports that the deployed Convex backend can answer public reads. */
export const get = query({
  args: {},
  returns: v.object({
    service: v.literal("convex"),
    state: v.literal("ready"),
  }),
  handler: () => ({
    service: "convex" as const,
    state: "ready" as const,
  }),
});
