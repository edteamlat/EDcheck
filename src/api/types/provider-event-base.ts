export type ProviderEventBase = {
  parseId: string;
  requestId: string;
  requestIndex: number;
  requestCount: number;
  provider: string;
  entry: "object" | "node";
  path?: readonly string[];
  ruleIds: readonly string[];
  timestamp: number;
};
