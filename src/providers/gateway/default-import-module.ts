import type { ImportModule } from "./types/import-module.ts";

export const defaultImportModule: ImportModule = (specifier) => {
  if (specifier === "ai") {
    return import("ai");
  }
  if (specifier === "@ai-sdk/gateway") {
    return import("@ai-sdk/gateway");
  }
  return Promise.reject(new Error(`Unknown module specifier: ${specifier}`));
};
