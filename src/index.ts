export { createEDcheck } from "./api/create-edcheck.ts";
export {
  EDcheckAbortError,
  EDcheckConfigError,
  EDcheckEnvironmentError,
  EDcheckError,
  EDcheckProviderError,
} from "./errors/index.ts";
export { DEFAULT_THRESHOLDS } from "./policy/default-thresholds.ts";
export { mockProvider } from "./providers/mock/mock-provider.ts";
export { typesafeProvider } from "./providers/typesafe/typesafe-provider.ts";
export { semantic } from "./rules/semantic.ts";

export type {
  EDcheck,
  EDcheckOptions,
  FieldPath,
  ParseOptions,
  SemanticSchema,
  SemanticSchemaOptions,
} from "./api/index.ts";
export type { FailurePolicy, Outcome, Thresholds } from "./policy/index.ts";
export type { MockProvider } from "./providers/mock/types/mock-provider.ts";
export type { MockProviderOptions } from "./providers/mock/types/mock-provider-options.ts";
export type { TypesafeProviderOptions } from "./providers/typesafe/types/typesafe-provider-options.ts";
export type {
  SemanticAnswer,
  SemanticProvider,
  SemanticQuestion,
  SemanticRequest,
  SemanticResponse,
  SemanticUsage,
} from "./providers/types/index.ts";
export type { Issue, SemanticResult } from "./result/index.ts";
export type { SemanticRule, SemanticRuleOptions, Severity } from "./rules/index.ts";
