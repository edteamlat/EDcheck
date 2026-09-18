## ADDED Requirements

### Requirement: Score questions and answers in the contract

`SemanticQuestion` SHALL be `NoulQuestion | ScoreQuestion` and `SemanticAnswer` SHALL be
`NoulAnswer | ScoreAnswer`, discriminated on `type`. A `ScoreQuestion` carries
`criteria: readonly string[]`; a `ScoreAnswer` carries `score`, `probabilities` (array indexed by
level) and `confidence`.

#### Scenario: Provider narrows on type

- **WHEN** a hand-written provider switches on `question.type` and returns `{ type: "score", score: 2, probabilities: [0, 0, 1], confidence: 1 }` for score questions and `{ type: "noul", noul: 0.9 }` otherwise
- **THEN** it type-checks and a mixed request parses with the expected outcomes

#### Scenario: Provider module still has no forbidden imports

- **WHEN** the import graph of `src/providers/**` is inspected after adding the union types
- **THEN** it contains no import from `src/rules`, `src/schema`, `src/result`, `src/compiler` or `src/api`

### Requirement: Mock provider score answers

`mockProvider({ answers })` SHALL answer Score questions from
`{ probabilities: number[], confidence?: number }` (default confidence `1`), computing
`score = Σ i · pᵢ`. When no answer is configured for a Score question it SHALL put all probability
on the last level with confidence `1`. A numeric answer for a Score question is a test error and
SHALL throw a plain `Error`.

#### Scenario: Object answer

- **WHEN** `mockProvider({ answers: { d: { probabilities: [0.2, 0.3, 0.5], confidence: 0.7 } } })` evaluates a Score question `d`
- **THEN** the answer is `{ type: "score", score: 1.3, probabilities: [0.2, 0.3, 0.5], confidence: 0.7 }` (score within `1e-9`)

#### Scenario: Default confidence

- **WHEN** the answer omits `confidence`
- **THEN** `answer.confidence` is `1`

#### Scenario: Default score answer

- **WHEN** no answer is configured for a Score question with three criteria
- **THEN** the answer is `{ type: "score", score: 2, probabilities: [0, 0, 1], confidence: 1 }`

#### Scenario: Function answers receive the question

- **WHEN** `answers: (q) => q.type === "score" ? { probabilities: [1, 0] } : 0.5` is used with one question of each type
- **THEN** both answers have the type of their question

#### Scenario: Number for a score question throws

- **WHEN** `mockProvider({ answers: { d: 0.9 } })` evaluates a Score question `d`
- **THEN** `evaluate` rejects with a plain `Error` (not `EDcheckProviderError`)

#### Scenario: Mixed request answers by id

- **WHEN** `answers: { n: 0.2, s: { probabilities: [0, 1] } }` evaluates Noul `n` and Score `s`
- **THEN** `answers.n` is `{ type: "noul", noul: 0.2 }` and `answers.s.type` is `"score"`

### Requirement: TypeSafe adapter score mapping

`typesafeProvider` SHALL send Score questions unchanged, map a Score answer's `probabilities` map
(`{ "0": p, … }`) to an array indexed by level, keep `score` and `confidence`, drop `legend`, and
reject malformed Score answers with `EDcheckProviderError` code `malformed_response`.

#### Scenario: Request body carries score criteria

- **WHEN** the adapter evaluates a request with a Score question
- **THEN** the JSON body's `questions.<id>` deep-equals `{ type: "score", instructions, criteria: [...] }`

#### Scenario: Response mapping

- **WHEN** `fetch` returns `answers: { d: { type: "score", score: 1.6, legend: { "0": "a", "1": "b", "2": "c" }, probabilities: { "0": 0.05, "1": 0.3, "2": 0.65 }, confidence: 0.78 } }`
- **THEN** the adapter resolves `answers.d` as `{ type: "score", score: 1.6, probabilities: [0.05, 0.3, 0.65], confidence: 0.78 }`

#### Scenario: Probabilities keys must be contiguous indices

- **WHEN** `probabilities` is `{ "0": 0.5, "2": 0.5 }` for a three-level question
- **THEN** `evaluate` rejects with `code: "malformed_response"`

#### Scenario: Missing confidence

- **WHEN** a Score answer has no `confidence`
- **THEN** `evaluate` rejects with `code: "malformed_response"`

#### Scenario: Non-finite score

- **WHEN** `score` is `"1.6"` or `null`
- **THEN** `evaluate` rejects with `code: "malformed_response"`

#### Scenario: Type mismatch is malformed

- **WHEN** the response answers a Score question with `{ type: "noul", noul: 0.9 }`
- **THEN** `evaluate` rejects with `code: "malformed_response"`
