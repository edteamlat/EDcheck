## MODIFIED Requirements

### Requirement: Provisional default thresholds

The library SHALL export a frozen `DEFAULT_THRESHOLDS` whose values equal the calibration recorded in
`test/eval/baseline.json` (derived from real Jev observations over the fixture corpus), and SHALL
use it when no other level sets a value.

#### Scenario: Exported constant

- **WHEN** `DEFAULT_THRESHOLDS` is imported from `edcheck`
- **THEN** it is frozen, `0 < fail <= pass < 1`, and it deep-equals `{ pass: baseline.calibration.pass, fail: baseline.calibration.fail }`

#### Scenario: Defaults apply when nothing overrides

- **GIVEN** an instance, schema and rule with no thresholds
- **WHEN** a rule fails with a probability below `DEFAULT_THRESHOLDS.fail`
- **THEN** the issue has `thresholds` deep-equal to `DEFAULT_THRESHOLDS`

#### Scenario: Provenance is documented

- **WHEN** `docs/calibration.md` is read
- **THEN** it states the current values, the `recordedAt` date and `model` of the baseline, and the recalibration command

### Requirement: Probability to outcome mapping

For Noul rules the outcome SHALL be `pass` when `p ≥ pass`, `warning` when `fail ≤ p < pass` and
`fail` when `p < fail`. A `pass` outcome MUST NOT emit an issue. Boundary scenarios pin
`thresholds: { pass: 0.8, fail: 0.5 }` on the instance so they do not depend on the calibrated
default.

#### Scenario: Clear pass

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.95`
- **THEN** no issue is emitted for that rule

#### Scenario: Exactly at pass threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.8`
- **THEN** the outcome is `pass` and no issue is emitted

#### Scenario: Just below pass threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.79`
- **THEN** the issue has `outcome: "warning"` and `probability: 0.79`

#### Scenario: Exactly at fail threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.5`
- **THEN** the issue has `outcome: "warning"`

#### Scenario: Just below fail threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.49`
- **THEN** the issue has `outcome: "fail"`

#### Scenario: Extremes

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0` and, in a second parse, `1`
- **THEN** `0` yields `outcome: "fail"` and `1` yields no issue

#### Scenario: Collapsed band

- **GIVEN** thresholds `{ pass: 0.7, fail: 0.7 }`
- **WHEN** the answer is `0.7` and, in a second parse, `0.69`
- **THEN** `0.7` passes and `0.69` is `fail`; no answer can produce `warning`

#### Scenario: Default band boundaries

- **GIVEN** no thresholds at any level
- **WHEN** the answers are `DEFAULT_THRESHOLDS.pass`, `DEFAULT_THRESHOLDS.pass - 0.01`, `DEFAULT_THRESHOLDS.fail` and `DEFAULT_THRESHOLDS.fail - 0.01`
- **THEN** the outcomes are `pass`, `warning`, `warning` and `fail`
