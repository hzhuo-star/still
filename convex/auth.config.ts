import type { AuthConfig } from "convex/server";

import { env } from "./_generated/server";

/** Clerk JWT provider configuration for authenticated Convex functions. */
const authConfig = {
  providers: [
    {
      applicationID: "convex",
      domain: env.CLERK_JWT_ISSUER_DOMAIN,
    },
  ],
} satisfies AuthConfig;

export default authConfig;
