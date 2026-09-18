import type { Experimental_EvaluationModel } from "ai";

import { loadGatewaySdk } from "./load-ai-sdk.ts";
import type { ImportModule } from "./types/import-module.ts";

export async function resolveEvaluationModel(input: {
  model: string | Experimental_EvaluationModel;
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  importModule: ImportModule;
  cache: { instance?: Experimental_EvaluationModel };
}): Promise<Experimental_EvaluationModel> {
  if (typeof input.model !== "string") {
    return input.model;
  }
  if (input.cache.instance !== undefined) {
    return input.cache.instance;
  }
  const gateway = await loadGatewaySdk(input.importModule);
  const created = gateway.createGateway({
    ...(input.apiKey === undefined ? {} : { apiKey: input.apiKey }),
    ...(input.baseUrl === undefined ? {} : { baseURL: input.baseUrl }),
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  }).evaluationModel(input.model);
  input.cache.instance = created;
  return created;
}
