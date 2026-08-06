"use client";

import { useSyncExternalStore } from "react";

const REFRESH_MS = 30_000;

const listeners = new Set<() => void>();
let cachedNow = Date.now();
let intervalId: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (intervalId === undefined) {
    cachedNow = Date.now();
    intervalId = setInterval(() => {
      cachedNow = Date.now();
      for (const notify of listeners) {
        notify();
      }
    }, REFRESH_MS);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}

function readCachedNow(): number {
  return cachedNow;
}

/**
 * Read the current time as a shared, slowly ticking snapshot so relative
 * Post times stay fresh without impure clock reads during render. All
 * subscribers share one interval.
 *
 * @returns The cached current time in milliseconds since the epoch.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, readCachedNow, readCachedNow);
}
