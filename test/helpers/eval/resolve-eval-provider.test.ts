import { describe, expect, it } from "vitest";

import { EDcheckConfigError } from "edcheck";

import { resolveEvalProvider } from "./resolve-eval-provider.ts";

describe("Eval runner skip and provider selection", () => {
  it("Provider from environment", () => {
    expect(resolveEvalProvider({ TYPESAFE_API_KEY: "t" }).name).toBe("typesafe");
    expect(resolveEvalProvider({ AI_GATEWAY_API_KEY: "g" }).name).toBe("gateway");
  });

  it("Forced provider", () => {
    const provider = resolveEvalProvider({
      TYPESAFE_API_KEY: "t",
      AI_GATEWAY_API_KEY: "g",
      EDCHECK_EVAL_PROVIDER: "gateway",
    });
    expect(provider.name).toBe("gateway");
  });

  it("throws missing_api_key without keys", () => {
    try {
      resolveEvalProvider({});
      expect.fail("expected EDcheckConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(EDcheckConfigError);
      expect((error as EDcheckConfigError).code).toBe("missing_api_key");
    }
  });
});
