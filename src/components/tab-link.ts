/**
 * The shared look of one link in a horizontal tab row, marked current by an
 * underline in Still's accent rather than color alone.
 *
 * @param isCurrent - Whether the link points at the rendered route.
 * @returns The tab link's class list.
 */
export const tabLinkClassName = (isCurrent: boolean): string =>
  `flex min-h-touch flex-1 items-center justify-center border-b-2 text-sm font-medium no-underline transition-colors ease-still ${
    isCurrent
      ? "border-sage text-ink"
      : "border-transparent text-muted hover:text-ink"
  }`;
