import { describe, expect, it } from "vitest";

describe("public surface", () => {
  it("exports exactly the documented runtime symbols", async () => {
    const exported = Object.keys(await import("edcheck")).sort();
    expect(exported).toEqual([
      "DEFAULT_THRESHOLDS",
      "EDcheckAbortError",
      "EDcheckConfigError",
      "EDcheckEnvironmentError",
      "EDcheckError",
      "EDcheckProviderError",
      "createEDcheck",
      "mockProvider",
      "semantic",
      "typesafeProvider",
    ]);
  });
});
