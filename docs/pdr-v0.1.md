# EDcheck — Product Requirements & Technical Brief (v0.1)

> **Frozen document.** Converted from `EDcheck-PDR.pdf` (EDlabs · EDteam, v0.1, 17 Sep 2026).
> Kept as the historical product definition. Later decisions live in `openspec/constitution.md`,
> which supersedes this file wherever they differ. Do not edit this document; write a new version.

## Supersession map (17 Sep 2026)

| PDR section                                                                 | Status after architecture review                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| §6 `ed` namespace, `ed.string()`, `ed.object()`                             | **Replaced.** Schemas are plain Zod 4. EDcheck attaches semantic rules; it does not wrap primitives (constitution §2, §4.1) |
| §6.7, §17.1 presets                                                         | **Deferred.** Out of v1 (constitution §4.14)                                                                                |
| §7.4 pass / review / fail bands                                             | **Kept** as `pass                                                                                                           | warning | fail`, thresholds configurable in code (constitution §4.4, §4.5) |
| §7.5 async contract (`safeParseAsync`)                                      | **Kept in spirit.** Zod `parse` stays sync; semantic parse is the only async entry (names decided in first change)          |
| §9, §14 browser forms, injectable transport, `checkSemantic({ transport })` | **Replaced.** Server only. The app exposes its own route; client uses Zod directly (constitution §3.2, §4.2)                |
| §12 Jev integration, Noul compilation                                       | **Kept.** Noul default, Score opt-in (constitution §4.3, §7)                                                                |
| §12.3 provider abstraction                                                  | **Kept internal.** `SemanticProvider` contract with `typesafe`, `gateway`, `mock` adapters                                  |
| §15 caching                                                                 | **Deferred.** Out of v1 (constitution §4.13)                                                                                |
| §17 core primitives (string, number, boolean, object, array…)               | **Removed.** Provided by Zod                                                                                                |
| §20 open decisions                                                          | **Resolved** in constitution §4 except items listed in constitution §13                                                     |

---

## Front matter

- **Prepared for:** Software Architecture Planning
- **Product:** EDcheck
- **Organization:** EDlabs / EDteam
- **Status:** Product definition — pre-architecture
- **Version:** 0.1 · **Date:** 17 September 2026
- **Purpose:** Define the product contract, expected developer experience, behavioral requirements and constraints for EDcheck. The software architect should use it as input to produce the system architecture, ADRs, component boundaries, execution model and implementation roadmap.

## 1. Executive summary

EDcheck is a TypeScript validation library that extends traditional schema validation with semantic judgment powered initially by TypeSafe AI's Jev model. Its goal is to let developers validate not only whether data has the correct type, format or length, but whether the data makes sense in context.

The product should feel familiar to developers who use schema libraries such as Zod: schemas are declared in code, composed from primitive types, attached to objects and nested structures, and executed to obtain a structured result. EDcheck adds semantic rules that evaluate the meaning, plausibility, relevance and coherence of values or complete objects.

**Core product thesis:** deterministic validation answers "does this data have the right shape?"; EDcheck semantic validation additionally answers "does this data make sense for the thing it claims to represent?"

Jev is a strong initial execution engine because TypeSafe describes it as a System One model that evaluates typed questions against a supplied state and returns structured probabilities that application code can use directly. Noul, its yes/no primitive, returns a probability from 0 to 1 and is well aligned with semantic validation rules. EDcheck must nevertheless keep thresholds, severity and final control flow in application code rather than treating probabilistic output as deterministic truth.

## 2. What the architect is expected to produce

- Component and package boundaries for the TypeScript library and any server-side/runtime companion needed for secure Jev access.
- Execution pipeline for deterministic and semantic validators, including batching, concurrency, cancellation, retries and timeouts.
- Internal schema/type model and extension strategy for future primitives, adapters and semantic providers.
- Transport/security strategy for browser forms without exposing provider API keys.
- Error/result model, path attribution and severity semantics.
- Caching, observability, testing/evaluation and threshold calibration strategy.
- ADRs for the decisions that materially constrain the public API or long-term compatibility.
- MVP implementation plan and a roadmap toward broader schema-library capabilities.

## 3. Problem statement

Traditional validators are excellent at deterministic constraints: type checks, required fields, ranges, lengths, regular expressions, enumerations and relationships that can be encoded precisely. They are weak when validity depends on meaning.

| Example input                                                    | Traditional validation        | Desired semantic judgment                |
| ---------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `fullName = "asdfasdf"`                                          | Valid string; length may pass | Probably not a plausible human full name |
| `description` = 60 repeated characters                           | Meets `minLength`             | Not a meaningful project description     |
| `age = 7`, `occupation = "Senior engineer, 15 years experience"` | Each field may be valid       | Object is internally implausible         |
| `projectName = "Acme ERP"`                                       | Valid string                  | Plausible project name in context        |

Developers often compensate with ad-hoc LLM prompts, custom endpoints and one-off heuristics. That produces duplicated prompt logic, inconsistent result handling and poor composability. EDcheck should make semantic validation a first-class schema capability.

## 4. Product vision and principles

- **Schema-first.** EDcheck is a general data contract library; forms are an important consumer, not the product boundary.
- **Progressive disclosure.** Basic usage should require a short semantic statement; advanced users can provide structured criteria, thresholds and context.
- **Deterministic first.** Never spend a semantic-model call on failures that deterministic checks can reject locally.
- **Probabilistic by design.** The API must expose uncertainty/probability instead of pretending semantic judgments are absolute.
- **Atomic semantic rules.** Prefer several focused questions over one broad "is this object valid?" prompt.
- **Context inheritance.** Application/schema/object/field context should compose without forcing developers to repeat domain information.
- **Provider-aware, not provider-shaped.** Jev is the initial engine, but EDcheck's public domain model should be coherent on its own and avoid leaking unnecessary provider internals.
- **Form-friendly.** The same schemas must support field-level feedback and whole-object validation cleanly.

### 4.1 Product goals

- Provide a TypeScript API that feels natural to developers already familiar with schema validators.
- Support deterministic and semantic rules in one composable schema.
- Validate primitive values, nested objects, arrays and complete domain entities.
- Support semantic coherence checks across multiple properties.
- Return machine-readable issues with paths, severity and semantic evidence/probability.
- Provide a practical execution model for browser forms and server-side validation.
- Make simple cases very short while allowing detailed rules when stakes or ambiguity are higher.

### 4.2 Non-goals for the first release

- Full API parity with Zod or replacement of every Zod primitive/transform.
- A visual form builder.
- A general-purpose LLM orchestration framework.
- Autonomous decisions in high-stakes domains without application-defined thresholds and safeguards.
- Perfect inference of field intent from labels or property names.
- A promise that semantic validation is deterministic or universally correct.

## 5. Core domain model

### 5.1 Schema

A schema describes the expected structure and semantic contract of a value. Schemas are composable and can be nested. A semantic rule may exist on a primitive field, an object, an array or another schema node where meaningful.

### 5.2 Deterministic rule

A locally evaluable rule with an objective result, such as type, min/max, enum, regex, URL format or a programmatic refinement. These rules should execute before semantic rules by default.

### 5.3 Semantic rule

A rule whose outcome depends on interpretation of meaning or context. The basic representation is a human-readable statement. The advanced representation may include intent, positive/negative criteria, thresholds, severity and metadata.

```ts
name: ed.string().min(2).semantic("A plausible full name for a real person");

description: ed.string().semantic({
  intent: "Meaningful project description",
  valid: "Explains what the user wants to build or what problem they want to solve",
  invalid: "Meaningless, irrelevant, spam-like or too vague to understand",
  threshold: 0.85,
  severity: "warning",
});
```

### 5.4 Context

Context explains what the data represents and why it is being evaluated. Context may be provided as free text for basic usage or structured data for advanced usage. Internally, both forms should normalize into a consistent representation.

```ts
context: "Form used by a client to create a software project"

context: {
  domain: "software services",
  purpose: "create_project",
  audience: "client",
  locale: "es-BO"
}
```

### 5.5 Hierarchical context

Context is inherited from broader scopes toward the rule being executed. A field should not have to repeat information already declared at the application or object level.

```
application context → schema / object context → field context → semantic rule → current value or object state
```

Structured context should merge predictably, with the most specific level overriding keys from broader levels. Free-text context can be preserved as separate inherited segments or normalized into a description property; the architect should define a deterministic merge/serialization policy.

### 5.6 Semantic preset

A reusable semantic intent such as `person.fullName`, `organization.name` or `project.description`. Presets reduce prompt authoring and can encode tested criteria and recommended thresholds. Presets are a convenience layer; explicit semantic rules must always be possible.

### 5.7 Semantic issue

A structured problem emitted by a semantic rule. It must be attributable to a schema path whenever possible and carry enough metadata for code to decide whether to block, warn or simply inform the user.

## 6. Target developer experience (proposed public API)

> Exact method names and generics may be refined by the architect, but the capabilities should remain.

### 6.1 Package and namespace

```ts
import { ed } from "edcheck";
```

The public namespace should be `ed`. The package/product name is EDcheck.

### 6.2 Primitive + semantic validation

```ts
const FullName = ed.string().min(2).max(100).semantic("A plausible human full name");
```

### 6.3 Complete object validation

```ts
const Person = ed
  .object({
    name: ed.string().semantic("A plausible human full name"),
    age: ed.number().min(0),
    occupation: ed.string(),
    bio: ed.string(),
  })
  .semantic("The data coherently represents a plausible person");
```

### 6.4 Cross-field semantic refinement

```ts
const Person = ed
  .object({
    name: ed.string(),
    age: ed.number(),
    occupation: ed.string(),
    bio: ed.string(),
  })
  .semanticRefine([
    "The occupation is plausible given the person's age",
    "The biography is consistent with the supplied name and occupation",
  ]);
```

Cross-field rules evaluate the complete current object state. They may still attribute an issue to one or more paths if the rule definition supplies target paths or if a supported attribution mechanism can do so reliably.

### 6.5 Context on schemas and nodes

```ts
const Project = ed.object(
  {
    name: ed.string().semantic("A plausible project name"),
    description: ed.string().semantic("Meaningfully explains the project"),
  },
  {
    context: {
      domain: "software",
      purpose: "client project intake",
      locale: "es-BO",
    },
  },
);
```

### 6.6 Basic and advanced semantic syntax

```ts
// Basic
ed.string().semantic("A plausible pet name");

// Advanced
ed.string().semantic({
  intent: "pet_name",
  valid: "Looks like a reasonable name a person could give a pet",
  invalid: "Random text, a long description, spam or unrelated content",
  threshold: 0.88,
  severity: "error",
});
```

### 6.7 Presets

```ts
ed.string().semantic("person.fullName");
// or, if the final API makes presets explicit:
ed.string().preset("person.fullName");
```

The architect should decide whether presets use a dedicated method to avoid ambiguity between a free-text rule and a preset key. Explicitness is preferable if it prevents accidental collisions.

## 7. Validation execution model

### 7.1 Default pipeline

1. Parse/check the local data shape.
2. Run deterministic constraints and programmatic refinements.
3. If deterministic errors make semantic evaluation meaningless, skip affected semantic rules by default.
4. Resolve inherited context for each semantic rule.
5. Build semantic questions against the appropriate state (field value or complete object).
6. Batch compatible questions when possible.
7. Execute Jev evaluation asynchronously.
8. Apply application/library thresholds and severity policies.
9. Return a unified structured validation result.

### 7.2 Atomic questions

Semantic rules should be compiled into focused questions rather than one broad judgment. This matches TypeSafe's guidance: each question should be specific and well scoped, while application code composes the results. Jev can evaluate multiple independent questions against the same state in one API call, which makes batching a core optimization opportunity.

### 7.3 State selection

| Rule location          | Default state                              | Example                                                                    |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Primitive field        | Field value + inherited context            | Is "asdfasdf" a plausible full name?                                       |
| Nested object          | Complete nested object + inherited context | Do company name, site and description coherently describe an organization? |
| Root object            | Complete root object                       | Does this payload coherently represent a person?                           |
| Cross-field refinement | Complete containing object                 | Is occupation plausible for the supplied age?                              |

### 7.4 Probabilities and thresholds

For Noul-style semantic rules, EDcheck should treat Jev's returned `noul` value as the probability that the statement is true. Noul does not have a separate confidence property. The library should compare this probability with a configurable threshold to determine rule status. For any future Choice/Score-based rules, their distinct probability/confidence semantics must remain explicit.

```
semantic probability >= pass threshold  → pass
semantic probability in review range    → warning / review
semantic probability < fail threshold   → fail
```

Thresholds must not be hard-coded globally as if one number fits every domain. Defaults can exist, but the API must allow rule/schema/application overrides. High-stakes actions should support stricter policies than advisory UX feedback.

### 7.5 Async contract

Any schema containing semantic rules is inherently asynchronous. The public API must make this obvious and difficult to misuse. The architect should decide whether EDcheck exposes only async parse methods for semantic schemas, separate sync/async methods, or statically distinguishes semantic schemas at the type level.

```ts
const result = await User.safeParseAsync(data);
```

## 8. Result and error model

Consumers need one result model for deterministic and semantic failures. Semantic issues require additional metadata but should still participate in normal path-based error handling.

```json
{
  "success": false,
  "issues": [
    {
      "path": ["occupation"],
      "code": "semantic",
      "severity": "error",
      "message": "Occupation is implausible given the supplied age",
      "probability": 0.03,
      "threshold": 0.85,
      "ruleId": "occupation_age_coherence"
    }
  ]
}
```

### 8.1 Required issue properties

| Property          | Requirement                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `path`            | Array path compatible with nested objects/arrays; may be empty for root-level issues              |
| `code`            | Stable machine-readable code distinguishing deterministic vs semantic issue classes               |
| `message`         | Human-readable default message; should be overridable/localizable                                 |
| `severity`        | At least `error` and `warning`; `info` may be supported                                           |
| `ruleId`          | Stable semantic rule identifier when available                                                    |
| `probability`     | For Noul semantic rules, the returned probability of the positive statement                       |
| `threshold`       | The threshold used to determine the rule outcome                                                  |
| provider metadata | Optional debug/telemetry metadata without forcing provider internals into normal application code |

### 8.2 Severity vs validity

A semantic judgment must not automatically imply "block submission." Rule severity determines how the outcome affects the overall result. A warning may be displayed to the user while still allowing continuation. Blocking behavior should remain an explicit policy, not an accidental consequence of using AI.

## 9. Forms as a first-class use case

EDcheck is not a form-only library, but forms must be supported exceptionally well because they benefit directly from semantic feedback before submission.

### 9.1 Three validation moments

| Moment                           | What runs                                                              | Expected UX                                                 |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| While typing                     | Cheap deterministic checks                                             | Immediate feedback; no semantic network call by default     |
| Blur / debounce / explicit check | Field-level semantic rules                                             | Warn or mark a field once the user has provided enough text |
| Submit                           | All deterministic + relevant field semantic + object/cross-field rules | Final coherent decision over the complete payload           |

### 9.2 Form-specific requirements

- Support validating a single field/node without forcing evaluation of the whole object.
- Support debouncing and cancellation through adapters or a transport layer; stale semantic results must not overwrite newer input state.
- Support path-based issues that form libraries can map to specific inputs.
- Support warnings independently from blocking errors.
- Support full-object semantic checks at submit time.
- Do not expose Jev/API credentials in browser bundles.
- Allow the consumer to decide whether semantic validation happens on blur, after idle/debounce, manually, or only on submit.

### 9.3 Intent inference from field metadata

Automatic inference from a field name or label may be offered as an optional convenience, but it must not be the semantic source of truth. Unambiguous metadata such as `fullName` may map to a preset; ambiguous labels such as `name`, `title` or `description` should require explicit intent or broader context unless the developer opts into best-effort inference.

| Field         | Inference                                    |
| ------------- | -------------------------------------------- |
| `fullName`    | → `person.fullName` (plausible preset)       |
| `companyName` | → `organization.name` (plausible preset)     |
| `name`        | ambiguous — require context or explicit rule |
| `description` | ambiguous — require context or explicit rule |

## 10. General schema use cases

| Source          | Example semantic requirement                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| API request     | Payload represents a legitimate support request, not spam or unrelated content |
| Webhook         | Event description is coherent with the event type and supplied metadata        |
| CSV import      | Imported product descriptions are meaningful and category-appropriate          |
| Database record | Entity fields are internally coherent before migration or publication          |
| LLM output      | Generated structured data is semantically consistent with the original source  |
| Scraped data    | Extracted title/description/category appear to refer to the same item          |
| Agent tool call | Arguments are plausible and relevant before executing a tool                   |
| Form            | Field meaning and complete submission coherence are checked before acceptance  |

## 11. Context model requirements

### 11.1 Free-text context

```ts
const CreateProject = ed.object({...}, {
  context: "Client intake form for requesting a custom software project"
})
```

This is the basic path: short, readable and low ceremony.

### 11.2 Structured context

```ts
context: {
  domain: "software development",
  purpose: "project intake",
  audience: "prospective client",
  locale: "es-BO",
  channel: "web form"
}
```

Structured context enables predictable merging, analytics, preset selection and provider-specific serialization. The context object should allow user-defined keys rather than only a fixed closed shape, while reserving a documented set of common keys if useful.

### 11.3 Inheritance and override

```
app context     { domain: "marketplace", locale: "es" }
object context  { purpose: "create_project" }
field context   { audience: "freelancers" }
------------------------------------------------
effective       { domain: "marketplace", locale: "es", purpose: "create_project", audience: "freelancers" }
```

### 11.4 Context minimization

EDcheck should send only the context and state needed for a rule. Sending the complete application object to every field validator increases cost, latency and privacy exposure. The architecture should support rule-level state selection and future redaction/exclusion controls.

## 12. Jev integration requirements

The first semantic provider is TypeSafe AI Jev. As of 17 September 2026, TypeSafe documents Jev as accepting a state plus typed questions and returning structured answers. Multiple questions can be evaluated against the same state in one call. For yes/no judgments, Noul returns a single 0–1 probability.

### 12.1 Rule compilation

A semantic rule should compile into a focused Noul question whenever the requirement is naturally yes/no. Advanced criteria should map to Noul instructions plus true/false criteria where useful.

```ts
// EDcheck rule
.semantic({
  intent: "Meaningful project description",
  valid: "Explains what the user wants to build",
  invalid: "Irrelevant, meaningless or too vague"
})

// Conceptual Jev question
{
  type: "noul",
  instructions: "The description meaningfully explains the software project",
  criteria: {
    true: "Explains what the user wants to build or solve",
    false: "Irrelevant, meaningless or too vague to understand"
  }
}
```

### 12.2 Batch optimization

When several semantic rules share the same state, EDcheck should be able to submit them in one Jev call rather than issuing one request per rule. The execution planner must preserve independent rule identities and map each returned answer to the corresponding schema issue/path.

### 12.3 Provider abstraction

EDcheck may remain Jev-first publicly, but the internal design should isolate provider transport and response mapping enough to support mocking, testing and possible future semantic providers. This should not force a premature generic abstraction into the user-facing API.

## 13. Non-functional requirements

| Area                     | Requirement                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Performance              | Deterministic validation must remain local/fast. Semantic calls should batch compatible rules and avoid duplicate work   |
| Latency                  | Support cancellation, timeout and stale-result protection. Form UX must not freeze while semantic validation runs        |
| Cost                     | Expose usage hooks/telemetry and caching options; avoid calls when deterministic validation already fails                |
| Reliability              | Define retry policy for transient failures and explicit behavior when the semantic provider is unavailable               |
| Security                 | Provider secrets must not be exposed to browsers. Transport boundaries must be clear                                     |
| Privacy                  | Allow minimization of state/context sent to the provider; document implications of sending PII                           |
| Type safety              | Schema inference should produce useful TypeScript input/output types comparable in ergonomics to modern schema libraries |
| Tree-shaking / footprint | Core deterministic functionality should not require shipping server/provider code into client bundles unnecessarily      |
| Observability            | Hooks for duration, provider calls, token/usage data, cache hit, rule outcomes and errors                                |
| Testability              | Semantic provider must be mockable; rules should support fixture-based evaluation and threshold calibration              |
| Compatibility            | Target modern TypeScript/Node first; browser usage via a secure transport strategy. Exact runtime matrix to be decided   |

## 14. Browser and transport constraints

**Critical architectural constraint:** form-friendly does not mean "put the TypeSafe API key in the browser."

A React/Vue/Svelte application should be able to use EDcheck schemas for immediate local checks and semantic field UX, but semantic provider calls must cross a trusted server boundary unless TypeSafe offers a safe delegated/client-token mechanism. The architect should design a transport contract that lets the client request semantic validation from an application backend, server action, edge function or EDcheck companion endpoint.

```ts
// Conceptual client usage
const result = await schema.field("description").checkSemantic(value, {
  transport: appSemanticTransport,
});
```

The transport should be injectable so EDcheck is not tied to one web framework. Framework adapters can be separate packages later.

## 15. Caching, concurrency and stale results

- Cache keys should include normalized rule identity, relevant state, effective context, model/provider version and threshold-affecting configuration where appropriate.
- Form field checks should support `AbortSignal` or an equivalent cancellation mechanism.
- A response generated for an older field value must never overwrite a newer validation state.
- Cache policy must be configurable because privacy-sensitive or rapidly changing values may not be appropriate to persist.
- Batching should group rules sharing the same state/provider request without changing semantic independence.

## 16. Configuration hierarchy

Configuration should follow the same "broad defaults, specific override" model as context:

```
library defaults → configured EDcheck instance → schema / object settings → field settings → semantic rule settings
```

| Setting        | Examples                                 |
| -------------- | ---------------------------------------- |
| Provider/model | Jev model identifier, API base/transport |
| Thresholds     | Default pass/fail/review thresholds      |
| Severity       | Default error/warning policy             |
| Timeout/retry  | Provider request resilience              |
| Cache          | On/off, TTL, storage strategy            |
| Context        | Global domain/locale/purpose             |
| Observability  | Logger/hooks/tracer callbacks            |

## 17. Proposed MVP scope

The MVP should prove the semantic-schema concept without attempting immediate Zod parity.

| Capability                | MVP expectation                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Core primitives           | string, number, boolean, literal/enum as needed, object, array, optional/nullable           |
| Deterministic rules       | Required/basic string and number constraints sufficient for realistic examples              |
| Semantic rule             | `semantic(string \| object)` on primitive and object schemas                                |
| Cross-field semantic rule | Object-level `semanticRefine` or equivalent                                                 |
| Context                   | String or object; hierarchical inheritance and override                                     |
| Jev provider              | Noul-based rule execution; multiple questions batched when state matches                    |
| Async parse               | Structured success/issues result                                                            |
| Issue paths               | Field and root-level paths, severity, probability and threshold                             |
| Form support              | Single-node/field semantic validation and full-object submit validation; cancellation hooks |
| Transport abstraction     | Secure server/provider access without leaking API keys to client                            |
| Testing                   | Provider mock + fixtures; basic evaluation harness                                          |

### 17.1 Candidate post-MVP capabilities

- Large preset catalog and community-defined semantic presets.
- Conservative intent inference from property names/labels/form metadata.
- React Hook Form and other form-library adapters.
- Alternative semantic primitives based on Jev Choice and Score.
- Localization of messages and preset criteria.
- Schema serialization/inspection and devtools.
- Evaluation dashboards and rule calibration reports.
- Additional semantic providers if product strategy requires them.
- Broader deterministic-schema parity and transforms.

## 18. MVP acceptance scenarios

| Scenario                                               | Expected behavior                                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `fullName = "asdfasdf"` with person-name semantic rule | Deterministic string checks pass; semantic rule returns a low positive probability and produces an issue according to threshold/severity |
| Project description is long but meaningless            | `minLength` passes; semantic rule can warn/fail because content is not meaningful                                                        |
| Age/occupation conflict                                | Individual fields pass; object-level semantic rule produces a cross-field issue                                                          |
| Ambiguous field name `name`                            | No hidden assumption is required; developer can provide explicit rule/context. Optional inference may decline to infer                   |
| Browser form typing quickly                            | No semantic call per keystroke by default; stale/aborted results do not surface                                                          |
| Jev unavailable                                        | Deterministic validation still works; semantic provider failure is represented explicitly according to configured failure policy         |
| Several rules on the same object                       | Compatible semantic questions are batchable in one provider call and results map back to independent rules                               |
| Warning rule fails                                     | UI can display feedback without forcing overall blocking failure if policy allows continuation                                           |

## 19. Example end-to-end developer flows

### 19.1 General object validation

```ts
import { ed } from "edcheck";

const User = ed
  .object(
    {
      fullName: ed.string().min(2).semantic("A plausible human full name"),
      age: ed.number().min(0),
      occupation: ed.string(),
      bio: ed.string().semantic({
        intent: "Meaningful professional biography",
        valid: "Describes the person's professional background coherently",
        invalid: "Meaningless, irrelevant or clearly unrelated text",
        severity: "warning",
      }),
    },
    {
      context: { purpose: "public professional profile", locale: "es" },
    },
  )
  .semanticRefine("The occupation and biography are plausible given the supplied age");

const result = await User.safeParseAsync(input);
```

### 19.2 Form field validation

```ts
// After blur / debounce
const fieldResult = await User.field("bio").safeParseAsync(currentBio, {
  mode: "semantic",
});

// On submit
const result = await User.safeParseAsync(formValues);
```

The exact field-access API is architectural/product-design work, but EDcheck must provide an ergonomic way to validate a node independently while preserving its inherited context.

## 20. Open architecture and product decisions

| Decision                               | Why it matters                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sync/async type model                  | Should semantic schemas require `safeParseAsync` explicitly, or can the type system prevent accidental sync execution? |
| Provider transport boundary            | Core library vs separate server package; browser adapter contract; edge/server runtimes                                |
| Context merge semantics                | How strings and arbitrary objects inherit/override deterministically                                                   |
| Rule/path attribution                  | How object-level rules identify one or more affected fields without unreliable model-generated paths                   |
| Threshold model                        | Single pass threshold vs pass/review/fail bands; defaults and overrides                                                |
| Provider failure policy                | Fail closed, fail open, warning or explicit indeterminate status; likely configurable per rule/domain                  |
| Preset syntax                          | `semantic("person.fullName")` vs `preset("person.fullName")` and registry design                                       |
| Automatic intent inference             | Whether to ship in MVP, make opt-in, or defer until a tested preset/evaluation system exists                           |
| Schema type inference                  | How close EDcheck aims to Zod-style `infer` ergonomics initially                                                       |
| Cache ownership                        | Library-managed vs application-provided cache interface                                                                |
| Serialization and schema introspection | Needed for remote field validation and client/server schema sharing?                                                   |

## 21. Testing and evaluation strategy requirements

Semantic rules cannot be validated only with unit tests that assert one provider response. EDcheck needs an evaluation mindset from the beginning.

- Unit tests for schema composition, context merging, deterministic rules, batching and issue mapping using a mocked semantic provider.
- Fixture datasets containing positive, negative and ambiguous examples for each semantic preset/rule.
- Threshold calibration based on false-positive and false-negative tradeoffs for the use case.
- Regression evaluations when rules, prompts/criteria, provider model versions or serialization change.
- Tests for multilingual inputs and domain-specific ambiguity where supported.
- Form race-condition tests: debounce, cancellation, stale results and fast consecutive edits.

## 22. Product positioning

EDcheck should be positioned as semantic validation for TypeScript, not as an "AI form validator." Forms are the easiest demo, but the product value is broader: semantic contracts for arbitrary structured data.

**Working positioning:** "EDcheck — Semantic validation for TypeScript. Validate meaning, not just structure."

## 23. Terminology

| Term                     | Meaning in EDcheck                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Schema                   | Composable declaration of structural and semantic expectations                     |
| Deterministic validation | Objective locally computed constraint                                              |
| Semantic validation      | Model-assisted judgment about meaning, plausibility, relevance or coherence        |
| Context                  | Inherited information explaining domain/purpose/audience/locale or other semantics |
| Semantic rule            | Atomic judgment attached to a schema node or object state                          |
| Preset                   | Named reusable semantic rule/criteria package                                      |
| Probability              | For Noul, the model-returned probability that the yes/positive statement is true   |
| Threshold                | Application/library boundary used to map probability to pass/review/fail behavior  |
| Severity                 | How a failed/uncertain rule affects application UX and blocking behavior           |
| Issue                    | Structured validation finding with path, code, message and metadata                |

## 24. External assumptions verified for this brief

Verified against the public TypeSafe documentation on 17 September 2026; recheck during architecture/implementation if the provider evolves:

- Jev evaluates typed questions against a state and returns structured results rather than generated prose.
- TypeSafe exposes Choice, Score and Noul primitives; multiple questions can be evaluated against the same state in one call.
- Noul represents a yes/no judgment and returns a value from 0 to 1: the probability that the answer is yes.
- Noul accepts optional true/false criteria to clarify nuanced boundaries.
- TypeSafe recommends atomic, well-scoped questions and composing multiple judgments in application code.
- Choice and Score provide confidence derived from probability distributions; Noul does not expose a separate confidence value.

Sources: `https://docs.typesafe.ai/introduction` · `/primitives/noul` · `/confidence` · `/introduction/quickstart`

## 25. Architecture handoff checklist

- Confirm public API principles and any naming changes before implementation.
- Produce architecture diagram and package/module map.
- Define schema AST/internal type model and async execution planner.
- Define Jev adapter, batching strategy and secure client/server transport.
- Define result/issue types and path attribution rules.
- Define context normalization and merge rules.
- Define cache, cancellation, retry, timeout and provider failure policies.
- Define MVP runtime/version support and packaging strategy.
- Define evaluation harness and initial benchmark datasets.
- Record major decisions as ADRs and convert MVP into implementation milestones/issues.

**End state for architecture phase:** a design that preserves EDcheck's simple developer experience while making probabilistic semantic validation secure, observable, testable, cost-aware and composable across both forms and general domain objects.
