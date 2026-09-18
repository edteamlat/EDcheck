import { expectTypeOf, test } from "vitest";

import {
  createEDcheck,
  mockProvider,
  type EDcheckHooks,
  type EDcheckOptions,
  type ProviderErrorEvent,
  type ProviderErrorKind,
  type ProviderRequestEvent,
  type ProviderResponseEvent,
} from "edcheck";

test("Event fields are typed", () => {
  const hooks: EDcheckHooks = {
    onResponse: (event) => {
      expectTypeOf(event.outcomes).toEqualTypeOf<
        Readonly<Record<string, "pass" | "warning" | "fail">>
      >();
      expectTypeOf(event.durationMs).toEqualTypeOf<number>();
      void event.outcomes.fullName;
      void event.response.usage?.inputTokens;
    },
  };
  void hooks;
});

test("Error is unknown with a kind", () => {
  const hooks: EDcheckHooks = {
    onError: (event) => {
      expectTypeOf(event.kind).toEqualTypeOf<"provider" | "abort" | "unexpected">();
      expectTypeOf(event.error).toEqualTypeOf<unknown>();
      // @ts-expect-error error is unknown
      void event.error.message;
    },
  };
  void hooks;
});

test("Async hooks are accepted", () => {
  const hooks: EDcheckHooks = {
    onRequest: async () => {},
  };
  void hooks;
});

test("Unknown hook key rejected", () => {
  createEDcheck({
    provider: mockProvider(),
    // @ts-expect-error unknown hook key
    hooks: { onDone: () => {} },
  });
});

test("EDcheckOptions.hooks is EDcheckHooks", () => {
  expectTypeOf<EDcheckOptions["hooks"]>().toEqualTypeOf<EDcheckHooks | undefined>();
});

test("the five observability types are exported", () => {
  expectTypeOf<EDcheckHooks>().not.toBeNever();
  expectTypeOf<ProviderRequestEvent>().not.toBeNever();
  expectTypeOf<ProviderResponseEvent>().not.toBeNever();
  expectTypeOf<ProviderErrorEvent>().not.toBeNever();
  expectTypeOf<ProviderErrorKind>().toEqualTypeOf<"provider" | "abort" | "unexpected">();
});
