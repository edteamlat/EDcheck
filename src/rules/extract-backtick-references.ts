import { isPathLikeToken } from "./is-path-like-token.ts";

const BACKTICK = /`([^`]*)`/g;

export function extractBacktickReferences(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(BACKTICK)) {
    const token = match[1];
    if (token === undefined || token.length === 0 || !isPathLikeToken(token)) {
      continue;
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    found.push(token);
  }
  return found;
}
