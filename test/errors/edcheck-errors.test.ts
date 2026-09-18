import { describe, expect, it } from "vitest";

import { EDcheckConfigError, EDcheckProviderError } from "edcheck";

describe("EDcheckProviderError sdk code", () => {
  it("keeps code, retryable false and cause", () => {
    const cause = new Error("boom");
    const error = new EDcheckProviderError("sdk", { cause });
    expect(error.code).toBe("sdk");
    expect(error.retryable).toBe(false);
    expect(error.cause).toBe(cause);
  });
});

describe("EDcheckConfigError new codes", () => {
  it.each(["missing_peer_dependency", "unsupported_question_type", "missing_api_key"] as const)(
    "accepts %s",
    (code) => {
      const error = new EDcheckConfigError("x", code);
      expect(error.code).toBe(code);
    },
  );
});
