# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 — 2026-09-17

First public release. EDcheck binds semantic rules to an existing Zod 4 schema and evaluates
meaning on the server with TypeSafe Jev.

### Added

- `createEDcheck`, `define`, and `safeParse` for whole-object semantic validation
- `semantic()` rules: Noul (yes/no) by default and optional Score levels
- Cross-field rules with declared `paths` and backtick field references
- Inherited context (`instance → schema → node → rule`) sent only in `state`
- `bound.node(path)` for on-blur style single-field validation
- Providers: `typesafeProvider`, `gatewayProvider`, `providerFromEnv`, and `mockProvider`
- Observability hooks: `onRequest`, `onResponse`, `onError`
- Fail-open by default (`semantic_unavailable`); optional `closed` policy
- `AbortSignal` and `timeoutMs` on every async parse
- Evaluation harness and fixture corpus (`es` / `en`) behind `yarn eval`
- Calibrated `DEFAULT_THRESHOLDS` `{ pass: 0.7, fail: 0.7 }` from a real Jev 1.13.0 run
  (collapsed warning band; override to restore a range)

### Out of scope

- Rules on or through `z.array` (rejected at `define`)
- Cache, presets, Choice, React/RHF adapters
