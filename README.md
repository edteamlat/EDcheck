# EDcheck

Semantic validation for [Zod](https://zod.dev) schemas, powered by [TypeSafe Jev](https://docs.typesafe.ai/introduction).
Validate meaning, not just structure.

> **Status: pre-alpha.** No public API is published yet. The product contract is defined in
> [`openspec/constitution.md`](./openspec/constitution.md); implementation follows OpenSpec changes.

## The idea

Zod tells you `"asdfasdf"` is a valid 8-character string. EDcheck tells you it is not a person's name.

| Layer    | Owns                                            | Runs                              |
| -------- | ----------------------------------------------- | --------------------------------- |
| Zod 4    | shape: types, `min`, `max`, `regex`, `refine`   | client + server                   |
| EDcheck  | meaning: plausibility, coherence, relevance     | **server only**                   |
| Jev      | calibrated yes/no and score probabilities       | TypeSafe API or Vercel AI Gateway |
| Your app | thresholds, severity, when to validate, secrets | your code                         |

EDcheck does not wrap or re-export Zod. Your existing schema stays the schema. Semantic rules are
attached on the server, compiled into atomic Jev questions, batched into one request per object,
and mapped to `pass | warning | fail` with thresholds you control.

```ts
// shared — plain Zod, runs anywhere
import { z } from "zod";

export const User = z.object({
  fullName: z.string().min(2).max(100),
  age: z.number().min(0),
  occupation: z.string(),
});
```

```ts
// server — illustrative; final API is defined in the first OpenSpec change
const result = await parseSemantic(User, input, {
  rules: {
    fullName: semantic("A plausible full name for a real person"),
  },
  refine: [{ rule: "occupation is plausible for age", paths: ["age", "occupation"] }],
});

result.success; // false only when an issue has severity "error"
result.issues; // Zod issues + semantic issues with path, probability, thresholds
```

If Jev is unavailable, deterministic validation still applies and the result carries a
`semantic_unavailable` warning (fail-open by default).

## Development

Requires Node ≥ 20 and Yarn.

```sh
yarn install
yarn verify        # lint + typecheck + test + build
```

Work is spec-driven with [OpenSpec](https://github.com/Fission-AI/OpenSpec):
`openspec/constitution.md` (contract) → `openspec/changes/<change>/` (work) → `openspec/specs/` (truth).
Agent rules: [`AGENTS.md`](./AGENTS.md). Original brief: [`docs/pdr-v0.1.md`](./docs/pdr-v0.1.md).

## License

MIT © EDlabs / EDteam
