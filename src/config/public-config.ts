/** Environment variables required by the browser-facing application. */
type PublicConfig = {
  /** Clerk's public instance identifier. */
  readonly clerkPublishableKey: string;
  /** The deployed Convex client URL. */
  readonly convexUrl: string;
};

/** Raw browser-facing environment values read by the Next.js composition root. */
type PublicConfigInput = {
  /** Raw Clerk public key supplied by the hosting environment. */
  readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string | undefined;
  /** Raw Convex client URL supplied during the production build. */
  readonly NEXT_PUBLIC_CONVEX_URL: string | undefined;
};

/** A safe description of one invalid public configuration entry. */
type PublicConfigIssue = {
  /** The environment variable that needs attention. */
  readonly name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | "NEXT_PUBLIC_CONVEX_URL";
  /** Why the variable could not be parsed. */
  readonly reason: "invalid-url" | "missing";
};

/** Reports public configuration problems without including credential values. */
class InvalidPublicConfig extends Error {
  /** Stable error discriminator for exhaustive handling. */
  readonly _tag = "InvalidPublicConfig" as const;

  /**
   * Create a safe public configuration error.
   *
   * @param issues - Invalid environment names and safe failure reasons.
   */
  constructor(readonly issues: ReadonlyArray<PublicConfigIssue>) {
    super(
      `Invalid public configuration: ${issues.map((issue) => issue.name).join(", ")}`,
    );
  }
}

/** Result of parsing the browser-facing application configuration. */
type ParsePublicConfigResult =
  | { readonly _tag: "ok"; readonly value: PublicConfig }
  | { readonly _tag: "err"; readonly error: InvalidPublicConfig };

type ParsedField =
  | { readonly _tag: "ok"; readonly value: string }
  | { readonly _tag: "err"; readonly issue: PublicConfigIssue };

function parseRequiredValue(
  name: PublicConfigIssue["name"],
  value: string | undefined,
): ParsedField {
  if (value === undefined || value.trim() === "") {
    return { _tag: "err", issue: { name, reason: "missing" } };
  }

  return { _tag: "ok", value: value.trim() };
}

function parseRequiredHttpUrl(
  name: PublicConfigIssue["name"],
  value: string | undefined,
): ParsedField {
  const requiredValue = parseRequiredValue(name, value);

  if (requiredValue._tag === "err") {
    return requiredValue;
  }

  try {
    const parsedUrl = new URL(requiredValue.value);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { _tag: "err", issue: { name, reason: "invalid-url" } };
    }

    return { _tag: "ok", value: parsedUrl.origin };
  } catch {
    return { _tag: "err", issue: { name, reason: "invalid-url" } };
  }
}

/**
 * Parse public environment input at the application composition root.
 *
 * @param input - The process environment supplied by Next.js.
 * @returns Parsed public configuration or safe, actionable issues.
 */
export function parsePublicConfig(
  input: PublicConfigInput,
): ParsePublicConfigResult {
  const clerkPublishableKey = parseRequiredValue(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    input.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const convexUrl = parseRequiredHttpUrl(
    "NEXT_PUBLIC_CONVEX_URL",
    input.NEXT_PUBLIC_CONVEX_URL,
  );

  if (clerkPublishableKey._tag === "err" || convexUrl._tag === "err") {
    const issues = [clerkPublishableKey, convexUrl].flatMap((result) =>
      result._tag === "err" ? [result.issue] : [],
    );

    return { _tag: "err", error: new InvalidPublicConfig(issues) };
  }

  return {
    _tag: "ok",
    value: {
      clerkPublishableKey: clerkPublishableKey.value,
      convexUrl: convexUrl.value,
    },
  };
}
