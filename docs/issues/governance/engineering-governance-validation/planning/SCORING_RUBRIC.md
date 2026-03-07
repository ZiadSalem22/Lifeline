# Engineering Governance Validation Scoring Rubric

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Define the weighted scoring model used to evaluate each governance family and produce a final verdict.

---

## Scoring Dimensions

### Dimension 1: Scenario Coverage (Weight: 30%)

How well does the family handle realistic development scenarios?

| Score | Description |
|-------|-------------|
| 5 | All scenarios produce correct, specific, actionable guidance at every layer |
| 4 | ≥90% scenarios correct; minor gaps in specificity |
| 3 | ≥80% scenarios correct; some layers give generic or incomplete guidance |
| 2 | 60-79% scenarios correct; meaningful gaps in coverage |
| 1 | <60% scenarios correct; family misses major scenario categories |

### Dimension 2: Layer Coherence (Weight: 25%)

Are all 7 layers within the family internally consistent?

| Score | Description |
|-------|-------------|
| 5 | Zero contradictions, zero orphan rules, all layers reinforce each other |
| 4 | Zero contradictions, ≤2 orphan rules, strong cross-layer alignment |
| 3 | Zero contradictions, ≤5 orphan rules, adequate alignment |
| 2 | 1-2 contradictions found, or >5 orphan rules |
| 1 | Multiple contradictions, or significant layer misalignment |

### Dimension 3: Negative Resilience (Weight: 20%)

Does the family catch and flag adversarial or problematic inputs?

| Score | Description |
|-------|-------------|
| 5 | All adversarial scenarios caught with correct severity |
| 4 | All CRITICAL adversarial scenarios caught; ≥80% HIGH caught |
| 3 | All CRITICAL caught; 60-79% HIGH caught |
| 2 | 1+ CRITICAL adversarial scenario missed |
| 1 | Multiple adversarial scenarios pass without any finding |

### Dimension 4: Real-Code Applicability (Weight: 15%)

Does the family produce useful guidance on actual Lifeline code?

| Score | Description |
|-------|-------------|
| 5 | Pilot produces specific, actionable, proportionate findings with zero bad recommendations |
| 4 | Pilot produces good findings; minor proportionality issues |
| 3 | Pilot produces adequate findings; some generic or vague recommendations |
| 2 | Pilot produces mostly generic findings not specific to the code |
| 1 | Pilot produces incorrect or harmful recommendations |

### Dimension 5: Cross-Family Consistency (Weight: 10%)

Is the family's severity taxonomy, findings format, and verdict system compatible with all other families?

| Score | Description |
|-------|-------------|
| 5 | Fully compatible; shared terms have identical meanings across families |
| 4 | Compatible; ≤1 term with slightly different nuance |
| 3 | Mostly compatible; 2-3 terms need alignment |
| 2 | Significant inconsistencies in severity or format |
| 1 | Incompatible verdict or severity systems |

---

## Weighted Score Calculation

```
Family Score = (Scenario × 0.30) + (Coherence × 0.25) + (Resilience × 0.20) + (Applicability × 0.15) + (Consistency × 0.10)
```

Maximum possible: 5.00

---

## Verdict Categories

| Weighted Score | Verdict | Meaning |
|----------------|---------|---------|
| 4.50 - 5.00 | **PASS** | Family is production-ready. No changes required. |
| 3.50 - 4.49 | **PASS WITH DRIFT WARNINGS** | Family is usable but has minor gaps. Drift warnings documented; hardening recommended. |
| 2.50 - 3.49 | **NEEDS HARDENING** | Family has meaningful gaps. Specific fixes required before certification. |
| 1.00 - 2.49 | **FAIL** | Family has critical gaps. Substantial rework required. |

---

## Phase-Level Verdict

The overall Engineering Governance Validation Phase verdict is determined by:

| Condition | Phase Verdict |
|-----------|---------------|
| All 5 families PASS or PASS WITH DRIFT WARNINGS | **PHASE CERTIFIED** |
| 1-2 families NEED HARDENING, rest pass | **PHASE CERTIFIED WITH CONDITIONS** (hardening applied in WS6) |
| Any family FAILS | **PHASE NOT CERTIFIED** (requires rework cycle) |

---

## Evidence Requirements Per Verdict

Each family verdict must be supported by:
- Scenario pack with per-scenario results
- Layer coherence matrix
- Adversarial test results
- Real micro-pilot output and assessment
- Cross-family compatibility check results
