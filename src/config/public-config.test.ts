import { expect, test } from "vitest";

import { parsePublicConfig } from "./public-config";

test("normalizes the Convex deployment URL to an origin without a trailing slash", () => {
  const result = parsePublicConfig({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " test-publishable-key ",
    NEXT_PUBLIC_CONVEX_URL: "https://still.convex.cloud/",
  });

  expect(result).toEqual({
    _tag: "ok",
    value: {
      clerkPublishableKey: "test-publishable-key",
      convexUrl: "https://still.convex.cloud",
    },
  });
});
