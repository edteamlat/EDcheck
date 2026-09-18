export type ContextObject = {
  domain?: string;
  purpose?: string;
  audience?: string;
  locale?: string;
  channel?: string;
  notes?: string[];
  [key: string]: unknown;
};
