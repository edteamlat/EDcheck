import { defaultImportModule } from "./default-import-module.ts";
import { isModuleNotFound } from "./is-module-not-found.ts";
import { missingPeerError } from "./missing-peer-error.ts";
import type { AiSdkModule } from "./types/ai-sdk-module.ts";
import type { GatewaySdkModule } from "./types/gateway-sdk-module.ts";
import type { ImportModule } from "./types/import-module.ts";

const aiCache = new Map<ImportModule, Promise<AiSdkModule>>();
const gatewayCache = new Map<ImportModule, Promise<GatewaySdkModule>>();

async function loadNamed(
  importModule: ImportModule,
  specifier: "ai" | "@ai-sdk/gateway",
): Promise<unknown> {
  try {
    return await importModule(specifier);
  } catch (error) {
    if (isModuleNotFound(error)) {
      throw missingPeerError(specifier);
    }
    throw error;
  }
}

export async function loadAiSdk(
  importModule: ImportModule = defaultImportModule,
): Promise<AiSdkModule> {
  const cached = aiCache.get(importModule);
  if (cached !== undefined) {
    return cached;
  }
  const pending = loadNamed(importModule, "ai").then((module) => module as AiSdkModule);
  aiCache.set(importModule, pending);
  try {
    return await pending;
  } catch (error) {
    aiCache.delete(importModule);
    throw error;
  }
}

export async function loadGatewaySdk(
  importModule: ImportModule = defaultImportModule,
): Promise<GatewaySdkModule> {
  const cached = gatewayCache.get(importModule);
  if (cached !== undefined) {
    return cached;
  }
  const pending = loadNamed(importModule, "@ai-sdk/gateway").then(
    (module) => module as GatewaySdkModule,
  );
  gatewayCache.set(importModule, pending);
  try {
    return await pending;
  } catch (error) {
    gatewayCache.delete(importModule);
    throw error;
  }
}
