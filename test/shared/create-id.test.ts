import { describe, expect, it } from "vitest";

import { createId } from "../../src/shared/create-id.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("createId", () => {
  it("returns a UUID v4-shaped string", () => {
    expect(createId()).toMatch(uuid);
  });

  it("returns unique values across 1000 calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createId()));
    expect(ids.size).toBe(1000);
  });
});
