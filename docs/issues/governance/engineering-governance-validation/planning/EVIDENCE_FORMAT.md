# Engineering Governance Validation Evidence Format

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Define the templates used to record evidence during validation workstreams.

---

## Template 1: Scenario Definition

```markdown
### Scenario: [ID] — [Title]

**Family**: [code-quality | frontend | backend | data-model | refactor]
**Type**: [positive | negative | borderline | adversarial]
**Difficulty**: [easy | moderate | hard]

**Setup**: [Description of the code or change being evaluated]

**Expected governance behavior**:
- Instruction layer: [expected guidance]
- Skill layer: [expected guidance]
- Builder agent: [expected action/recommendation]
- Review agent: [expected findings and severity]
- Workflow: [expected steps triggered]
- Prompt: [expected output shape]

**Key rules exercised**: [List specific rules from instruction/skill that should activate]
```

---

## Template 2: Layer Validation Result

```markdown
### Layer Validation: [Family] — [Scenario ID]

| Layer | Expected | Actual | Pass/Fail | Notes |
|-------|----------|--------|-----------|-------|
| Instruction | [brief] | [brief] | ✅/❌ | |
| Skill | [brief] | [brief] | ✅/❌ | |
| Builder Agent | [brief] | [brief] | ✅/❌ | |
| Review Agent | [brief] | [brief] | ✅/❌ | |
| Team | [brief] | [brief] | ✅/❌ | |
| Workflow | [brief] | [brief] | ✅/❌ | |
| Prompt | [brief] | [brief] | ✅/❌ | |

**Cross-layer consistency**: [consistent | inconsistency found: describe]
**Scenario verdict**: [pass | fail | partial]
```

---

## Template 3: Adversarial Test Result

```markdown
### Adversarial Test: [ID] — [Title]

**Family**: [code-quality | frontend | backend | data-model | refactor]
**Attack vector**: [What the adversarial input tries to do]
**Expected rejection**: [Which rules should catch this, at which severity]

**Result**:
- Caught: [yes | no | partial]
- By which layer(s): [list]
- Severity assigned: [CRITICAL | HIGH | MEDIUM | LOW | none]
- Correct severity: [yes | under-rated | over-rated | missed]

**Evidence**: [Specific finding text or explanation of gap]
```

---

## Template 4: Micro-Pilot Result

```markdown
### Micro-Pilot: [Target] — [Family]

**Target file(s)**: [path(s)]
**Target description**: [What code was evaluated]
**Governance stack applied**: [Which agents/workflows/prompts were simulated]

**Findings produced**:
1. [Severity] [Category] — [Brief finding] — [Actionable: yes/no]
2. ...

**Quality assessment**:
- Specificity: [1-5] — Were findings specific to this code, not generic?
- Actionability: [1-5] — Could findings be implemented immediately?
- Correctness: [1-5] — Were recommendations sound engineering practice?
- Proportionality: [1-5] — Did severity match actual risk?
- Completeness: [1-5] — Were important issues found?

**Pilot verdict**: [pass | fail | partial]
```

---

## Template 5: Family Scorecard

```markdown
### Family Scorecard: [Family Name]

| Dimension | Weight | Score (1-5) | Weighted |
|-----------|--------|-------------|----------|
| Scenario Coverage | 0.30 | | |
| Layer Coherence | 0.25 | | |
| Negative Resilience | 0.20 | | |
| Real-Code Applicability | 0.15 | | |
| Cross-Family Consistency | 0.10 | | |
| **Total** | **1.00** | | **[sum]** |

**Verdict**: [PASS | PASS WITH DRIFT WARNINGS | NEEDS HARDENING | FAIL]

**Findings summary**:
- Strengths: [list]
- Gaps: [list]
- Hardening actions (if any): [list]
```

---

## Artifact routing

All validation evidence goes under:
```
docs/issues/governance/engineering-governance-validation/
├── discovery/
│   └── VALIDATION_BASELINE.md
├── planning/
│   ├── VALIDATION_MODEL.md
│   ├── SCORING_RUBRIC.md
│   └── EVIDENCE_FORMAT.md  (this file)
├── results/
│   ├── WS2_SCENARIO_PACKS.md
│   ├── WS3_LAYER_VALIDATION.md
│   ├── WS4_ADVERSARIAL_TESTS.md
│   └── WS5_MICRO_PILOT.md
└── final/
    └── ENGINEERING_GOVERNANCE_VALIDATION_CERTIFICATION_REPORT.md
```
