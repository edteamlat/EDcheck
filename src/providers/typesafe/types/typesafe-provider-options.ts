export type TypesafeProviderOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  retries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
};
