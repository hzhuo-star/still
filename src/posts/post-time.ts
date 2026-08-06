const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Format a Post's server publication time for its place in the Feed.
 *
 * @param publishedAt - Server creation time in milliseconds since the epoch.
 * @param now - The current time in milliseconds since the epoch.
 * @returns A short reading-first label: “now”, minutes, hours, or a date in
 *   the reader's local time zone.
 */
export function formatPublishedAt(publishedAt: number, now: number): string {
  const elapsed = now - publishedAt;

  if (elapsed < MINUTE) {
    return "now";
  }

  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m`;
  }

  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}h`;
  }

  const published = new Date(publishedAt);
  const sameYear = published.getFullYear() === new Date(now).getFullYear();

  return published.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Describe a Post's publication time for assistive technology and hover text.
 *
 * @param publishedAt - Server creation time in milliseconds since the epoch.
 * @returns A complete, unambiguous date-and-time description in the reader's
 *   local time zone.
 */
export function describePublishedAt(publishedAt: number): string {
  return new Date(publishedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}
