import { defineConfig } from "vitest/config";

/** Vitest configuration for exercising Convex functions in Edge Runtime. */
const vitestConfig = defineConfig({
  test: {
    environment: "edge-runtime",
  },
});

export default vitestConfig;
