import { describe, expect, it } from "vitest";

import pkg from "../package.json";

type PackageJson = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  exports: Record<string, unknown>;
  browser?: unknown;
};

const manifest: PackageJson = pkg;

describe("package contract (constitution §3, §11)", () => {
  it("declares zod as a peer dependency and never bundles it", () => {
    expect(manifest.peerDependencies?.zod).toBeDefined();
    expect(manifest.dependencies?.zod).toBeUndefined();
  });

  it("exposes a single server entry and no browser build", () => {
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json"]);
    expect(manifest.browser).toBeUndefined();
  });

  it("pulls in neither ai nor the TypeSafe SDK", () => {
    const dependencyNames = Object.keys(manifest.dependencies ?? {});
    expect(dependencyNames).not.toContain("ai");
    expect(dependencyNames).not.toContain("@typesafe-ai/sdk");
  });
});

describe("optional peer package contract", () => {
  it("declares optional AI SDK peer ranges", () => {
    expect(manifest.peerDependencies?.ai).toBe(">=7.0.105 <8");
    expect(manifest.peerDependencies?.["@ai-sdk/gateway"]).toBe(">=4.0.85 <5");
    expect(manifest.peerDependenciesMeta?.ai?.optional).toBe(true);
    expect(manifest.peerDependenciesMeta?.["@ai-sdk/gateway"]?.optional).toBe(true);
  });

  it("still has no runtime dependencies", () => {
    expect(manifest.dependencies).toBeUndefined();
  });

  it("marks the SDK external in the build", async () => {
    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    if (!existsSync("dist/index.js") || !existsSync("dist/index.cjs")) {
      return;
    }
    const esm = await readFile("dist/index.js", "utf8");
    const cjs = await readFile("dist/index.cjs", "utf8");
    expect(esm).toMatch(/import\(["']ai["']\)/);
    expect(cjs).toMatch(/import\(["']ai["']\)/);
    expect(esm.includes("async function experimental_evaluate")).toBe(false);
    expect(cjs.includes("async function experimental_evaluate")).toBe(false);
  });
});
