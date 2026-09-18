import { expectTypeOf, test } from "vitest";
import type { Experimental_EvaluationModel } from "ai";
import { Experimental_EvaluationMockModelV4 } from "ai/test";

import {
  gatewayProvider,
  providerFromEnv,
  type GatewayProviderOptions,
  type ProviderPreference,
  type SemanticProvider,
} from "edcheck";

test("GatewayProviderOptions.model accepts a string", () => {
  const options: GatewayProviderOptions = { model: "typesafe-ai/jev" };
  expectTypeOf(options.model).toMatchTypeOf<string | Experimental_EvaluationModel | undefined>();
});

test("GatewayProviderOptions.model accepts an evaluation model", () => {
  const options: GatewayProviderOptions = {
    model: new Experimental_EvaluationMockModelV4(),
  };
  expectTypeOf(options.model).toMatchTypeOf<Experimental_EvaluationModel | undefined>();
});

test("gatewayProvider returns SemanticProvider", () => {
  expectTypeOf(gatewayProvider()).toEqualTypeOf<SemanticProvider>();
});

test("ProviderPreference is the documented union", () => {
  expectTypeOf<ProviderPreference>().toEqualTypeOf<"typesafe" | "gateway">();
});

test("providerFromEnv returns SemanticProvider", () => {
  expectTypeOf(providerFromEnv({ env: { TYPESAFE_API_KEY: "t" } })).toEqualTypeOf<SemanticProvider>();
});

test("prefer rejects other values", () => {
  providerFromEnv({
    env: { TYPESAFE_API_KEY: "t" },
    // @ts-expect-error prefer is typesafe or gateway
    prefer: "other",
  });
});

test("model rejects a number", () => {
  const options: GatewayProviderOptions = {
    // @ts-expect-error model is a string or evaluation model
    model: 42,
  };
  void options;
});
