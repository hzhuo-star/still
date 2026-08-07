import { describe, expect, test } from "vitest";

import {
  onboardingHref,
  parseReturnPath,
  RETURN_PARAM,
} from "./onboarding-route";

describe("parseReturnPath", () => {
  test("keeps a same-origin route with its query string", () => {
    expect(parseReturnPath("/posts/abc123?reply=1")).toBe(
      "/posts/abc123?reply=1",
    );
  });

  test("falls back to the Feed for an absent or foreign target", () => {
    expect(parseReturnPath(null)).toBe("/");
    expect(parseReturnPath("https://example.com/steal")).toBe("/");
    expect(parseReturnPath("//example.com/steal")).toBe("/");
    expect(parseReturnPath("/\\example.com/steal")).toBe("/");
    expect(parseReturnPath("javascript:alert(1)")).toBe("/");
    expect(parseReturnPath("/posts/\u0000abc")).toBe("/");
  });

  test("never returns a Member to onboarding", () => {
    expect(parseReturnPath("/onboarding")).toBe("/");
    expect(parseReturnPath("/onboarding/step-2")).toBe("/");
  });
});

describe("onboardingHref", () => {
  test("carries a usable return target", () => {
    expect(onboardingHref("/members/abc123")).toBe(
      `/onboarding?${RETURN_PARAM}=%2Fmembers%2Fabc123`,
    );
  });

  test("omits the parameter when the Feed is the return target", () => {
    expect(onboardingHref("/")).toBe("/onboarding");
    expect(onboardingHref("/onboarding")).toBe("/onboarding");
  });
});
