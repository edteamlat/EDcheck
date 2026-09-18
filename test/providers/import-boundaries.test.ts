import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const providersRoot = path.join(srcRoot, "providers");
const contextRoot = path.join(srcRoot, "context");

const forbidden = ["/src/rules", "/src/schema", "/src/result", "/src/compiler", "/src/api"];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("provider import boundaries", () => {
  it("has no forbidden imports", async () => {
    const files = await collectFiles(providersRoot);
    expect(files.length).toBeGreaterThan(0);
    const importPattern = /from\s+["']([^"']+)["']/g;
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier === undefined || !specifier.startsWith(".")) {
          continue;
        }
        const resolved = path.resolve(path.dirname(file), specifier);
        if (forbidden.some((folder) => resolved.includes(folder))) {
          violations.push(`${path.relative(providersRoot, file)} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("context import boundaries", () => {
  it("imports only from src/shared", async () => {
    const files = await collectFiles(contextRoot);
    expect(files.length).toBeGreaterThan(0);
    const importPattern = /from\s+["']([^"']+)["']/g;
    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (specifier === undefined || !specifier.startsWith(".")) {
          continue;
        }
        const resolved = path.resolve(path.dirname(file), specifier);
        const allowed =
          resolved.includes(`${path.sep}src${path.sep}context`) ||
          resolved.includes(`${path.sep}src${path.sep}shared`);
        if (!allowed) {
          violations.push(`${path.relative(contextRoot, file)} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
