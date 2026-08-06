/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a visitor can read the Convex service status", async () => {
  const t = convexTest(schema, modules);

  await expect(t.query(api.status.get, {})).resolves.toEqual({
    service: "convex",
    state: "ready",
  });
});
