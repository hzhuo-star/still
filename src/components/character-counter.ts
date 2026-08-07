/**
 * The polite screen-reader announcement for a bounded text field's counter.
 *
 * Speaks only at spaced thresholds — every tenth remaining character from 20
 * down, and once past the limit — so continuous typing is never drowned out.
 *
 * @param remaining - How many characters the draft may still grow.
 * @param limit - The field's maximum length, named in the over-limit message.
 * @returns The announcement, or an empty string between thresholds.
 */
export function counterAnnouncement(remaining: number, limit: number): string {
  if (remaining < 0) {
    return `Over the ${limit} character limit.`;
  }

  if (remaining <= 20 && remaining % 10 === 0) {
    return `${remaining} characters left.`;
  }

  return "";
}
