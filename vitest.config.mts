import { configDefaults, defineConfig } from "vitest/config";

/** Vitest configuration for exercising Convex functions in Edge Runtime. */
const vitestConfig = defineConfig({
  test: {
    environment: "edge-runtime",
    // .repo/ holds vendored reference source with its own test suites.
    exclude: [...configDefaults.exclude, ".repo/**"],
  },
});

export default vitestConfig;
