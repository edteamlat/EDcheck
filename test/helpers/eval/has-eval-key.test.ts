import { describe, expect, it } from "vitest";

import { hasEvalKey } from "./has-eval-key.ts";

describe("hasEvalKey", () => {
  it("hasEvalKey", () => {
    expect(hasEvalKey({})).toBe(false);
    expect(hasEvalKey({ TYPESAFE_API_KEY: "" })).toBe(false);
    expect(hasEvalKey({ TYPESAFE_API_KEY: "t" })).toBe(true);
    expect(hasEvalKey({ AI_GATEWAY_API_KEY: "g" })).toBe(true);
  });
});
