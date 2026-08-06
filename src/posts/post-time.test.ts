import { describe, expect, test } from "vitest";

import { describePublishedAt, formatPublishedAt } from "./post-time";

const NOW = Date.UTC(2026, 7, 6, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatPublishedAt", () => {
  test("labels the first minute as now", () => {
    expect(formatPublishedAt(NOW - 30_000, NOW)).toBe("now");
  });

  test("labels recent Posts in minutes", () => {
    expect(formatPublishedAt(NOW - 5 * MINUTE, NOW)).toBe("5m");
    expect(formatPublishedAt(NOW - 59 * MINUTE, NOW)).toBe("59m");
  });

  test("labels same-day Posts in hours", () => {
    expect(formatPublishedAt(NOW - HOUR, NOW)).toBe("1h");
    expect(formatPublishedAt(NOW - 23 * HOUR, NOW)).toBe("23h");
  });

  test("labels older same-year Posts with a month and day", () => {
    const label = formatPublishedAt(NOW - 30 * DAY, NOW);

    expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  test("labels prior-year Posts with the year", () => {
    const label = formatPublishedAt(NOW - 400 * DAY, NOW);

    expect(label).toContain("2025");
  });
});

describe("describePublishedAt", () => {
  test("produces a complete date-and-time description", () => {
    const description = describePublishedAt(NOW);

    expect(description).toContain("2026");
    expect(description).toMatch(/\d{1,2}:\d{2}/);
  });
});
