declare const returnPathBrand: unique symbol;

/**
 * A same-origin route Still may navigate a Member to after Registration.
 *
 * Only {@link parseReturnPath} produces one, so a navigation target can never
 * be an arbitrary string that arrived in a URL.
 */
export type ReturnPath = string & { readonly [returnPathBrand]: true };

/** The onboarding route an unregistered identity completes exactly once. */
export const ONBOARDING_PATH = "/onboarding";

/** The search parameter carrying the route to resume after Registration. */
export const RETURN_PARAM = "next";

// SAFETY: TypeScript cannot express the brand. The Feed is the fallback for
// every unusable target, and it is a same-origin route by construction.
const FEED_PATH = "/" as ReturnPath;

/**
 * Parse an untrusted return target into a route Still may navigate to.
 *
 * Only same-origin absolute paths survive, so a crafted `next` value cannot
 * send a Member to another origin or a `javascript:` URL. Onboarding itself is
 * never a return target, because returning there would loop. An unusable value
 * is the Feed rather than a failure: a Member who finished Registration should
 * still enter Still.
 *
 * @param raw - The raw `next` value read from the URL, or `null` when absent.
 * @returns The route to resume, or the Feed when the value is unusable.
 */
export function parseReturnPath(raw: string | null): ReturnPath {
  if (raw === null || !raw.startsWith("/")) {
    return FEED_PATH;
  }

  // `//host` and `/\host` are treated as protocol-relative by browsers.
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return FEED_PATH;
  }

  // Control characters never appear in a route Still generated.
  if (/[\u0000-\u001F\u007F]/u.test(raw)) {
    return FEED_PATH;
  }

  if (
    raw === ONBOARDING_PATH ||
    raw.startsWith(`${ONBOARDING_PATH}/`) ||
    raw.startsWith(`${ONBOARDING_PATH}?`)
  ) {
    return FEED_PATH;
  }

  // SAFETY: TypeScript cannot express the brand. Every check above rejected
  // targets that are not same-origin routes, and callers cannot construct a
  // ReturnPath except through this parser.
  return raw as ReturnPath;
}

/**
 * Build the onboarding link that remembers where a Member was interrupted.
 *
 * @param returnTarget - The route the Member is currently on.
 * @returns The onboarding route, carrying a usable return target when there
 *   is one.
 */
export function onboardingHref(returnTarget: string): string {
  const parsed = parseReturnPath(returnTarget);

  return parsed === FEED_PATH
    ? ONBOARDING_PATH
    : `${ONBOARDING_PATH}?${RETURN_PARAM}=${encodeURIComponent(parsed)}`;
}
