import { describe, expect, it } from "vitest";

describe("public surface", () => {
  // Public surface unchanged by observability-hooks and node-validation (types only).
  it("exports exactly the documented runtime symbols", async () => {
    const exported = Object.keys(await import("edcheck")).sort();
    expect(exported).toEqual([
      "DEFAULT_MIN_CONFIDENCE",
      "DEFAULT_THRESHOLDS",
      "EDcheckAbortError",
      "EDcheckConfigError",
      "EDcheckEnvironmentError",
      "EDcheckError",
      "EDcheckProviderError",
      "createEDcheck",
      "gatewayProvider",
      "mockProvider",
      "providerFromEnv",
      "semantic",
      "typesafeProvider",
    ]);
  });
});
