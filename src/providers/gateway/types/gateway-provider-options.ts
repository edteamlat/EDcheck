import type { Experimental_EvaluationModel } from "ai";

export type GatewayProviderOptions = {
  apiKey?: string;
  model?: string | Experimental_EvaluationModel;
  baseUrl?: string;
  maxRetries?: number;
  fetch?: typeof fetch;
};
