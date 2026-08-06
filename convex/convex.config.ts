import { defineApp } from "convex/server";
import { v } from "convex/values";

/** Typed application requirements supplied by each Convex deployment. */
const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
  },
});

export default app;
