import { describe, expect, it } from "vitest";

import { isReservedPath } from "../../src/schema/is-reserved-path.ts";

describe("isReservedPath", () => {
  it("matches the reserved first segment and descendants", () => {
    expect(isReservedPath(["context"])).toBe(true);
    expect(isReservedPath(["context", "foo"])).toBe(true);
  });

  it("does not match other keys", () => {
    expect(isReservedPath(["fullName"])).toBe(false);
    expect(isReservedPath(["contextual"])).toBe(false);
  });
});
