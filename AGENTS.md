# EDcheck — agent rules

## Before touching code

1. Read `openspec/constitution.md`. It is normative. §4 (decisions) is not reopened in a change.
2. Read `openspec/config.yaml` and the specs in `openspec/specs/`.
3. All work lives in an OpenSpec change: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.
   No change, no code.
4. Open questions are in constitution §13. They are closed in the change's `design.md`.

## What it is and what it is not

- EDcheck validates **meaning** of data whose **shape** Zod already validated. It runs **server only**.
- It does not re-export Zod. It does not ship a browser bundle. It does not generate text with Jev.
- Zod is a `peerDependency`. Never a `dependency`. `test/package-contract.test.ts` guards this.

## Code

- Yarn. Never npm or pnpm.
- One exported symbol per file. Types and interfaces under the module's `types/`, one per file.
  kebab-case. `index.ts` barrel per module.
- Modules and import boundaries: constitution §11. `providers/` knows nothing about `rules/`, `schema/` or `result/`.
- Explicit return type on every exported function. No `any`. No `console` in `src/`.
- Do not install dependencies not listed in the change's `design.md`.
- The user value goes in `state`. Never inside `instructions` or `criteria`.
- Every async API accepts `signal`. A cancelled result is never emitted.

## Tests

- Unit: `test/<module>/<file>.test.ts`, with the `mock` provider. No network.
- Eval: `test/eval/`, against real Jev; skipped without `TYPESAFE_API_KEY` or `AI_GATEWAY_API_KEY`.
- Fixtures: `test/fixtures/<rule>/{es,en}.json` with positive, negative and ambiguous cases.
- DoD of every task: `yarn verify` green.

## Commits

Conventional commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Reference `#n` when an issue exists.

## Language

Everything in English: specs, docs, code, comments, commit messages.
