# Engineering Governance Validation Model

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Define the 4 validation types that will be applied to all 5 governance families, including what each type tests and what evidence it produces.

---

## Validation Type 1: Scenario-Based Validation (WS2 + WS3)

### What it tests
Whether each family's governance artifacts correctly guide behavior when faced with realistic development scenarios.

### Method
1. Define 5-6 scenarios per family (good code, bad code, borderline cases).
2. For each scenario, walk through every layer (instruction → skill → builder agent → review agent → workflow → prompt).
3. Record whether each layer gives correct, useful, non-contradictory guidance.

### Evidence produced
- Scenario pack per family (WS2)
- Layer-by-layer validation matrix per family (WS3)
- Per-scenario pass/fail with notes

### Pass criteria
- ≥80% of scenarios produce correct guidance at every layer
- Zero scenarios produce contradictory guidance between layers

---

## Validation Type 2: Negative/Adversarial Validation (WS4)

### What it tests
Whether each family correctly rejects, warns about, or flags problematic inputs that attempt to circumvent governance rules.

### Method
1. Define 3-4 adversarial scenarios per family.
2. Verify that the governance artifacts would produce warnings, findings, or rejection for each adversarial input.
3. Test boundary cases where the adversarial input is "almost" valid.

### Evidence produced
- Adversarial scenario pack per family
- Expected-rejection matrix with actual results

### Pass criteria
- 100% of CRITICAL adversarial scenarios are caught
- ≥80% of HIGH adversarial scenarios produce appropriate warnings
- No adversarial scenario silently passes without any finding

---

## Validation Type 3: Real Micro-Pilot (WS5)

### What it tests
Whether the governance system produces actionable, useful guidance on real Lifeline code — not just hypothetical scenarios.

### Method
1. Select 1 real target per domain (frontend component, backend route, refactor candidate, data model area).
2. Run the relevant governance stack end-to-end against the real code.
3. Evaluate whether the guidance is:
   - Specific (not generic boilerplate)
   - Actionable (could be implemented)
   - Correct (doesn't recommend bad practices)
   - Proportionate (severity matches actual risk)

### Evidence produced
- Micro-pilot target selection with rationale
- Full governance output for each target
- Quality assessment of each output

### Pass criteria
- Each pilot produces ≥3 specific, actionable findings
- Zero findings recommend practices that contradict governance rules
- Findings are proportionate to actual code risk

---

## Validation Type 4: Structural Coherence (WS3 + WS6)

### What it tests
Whether the internal structure of each family is consistent — no orphan rules, no contradictions, no missing cross-references.

### Method
1. For each family, extract all rules from the instruction file.
2. Trace each rule through skill → agents → workflow → prompt.
3. Identify orphan rules (defined but never exercised) and phantom rules (exercised but never defined).
4. Check for contradictions between layers.

### Evidence produced
- Rule tracing matrix per family
- Orphan/phantom rule inventory
- Contradiction inventory

### Pass criteria
- ≤5% orphan rules per family
- Zero phantom rules (all exercised rules have a source definition)
- Zero contradictions between layers

---

## Workstream-to-Validation-Type Mapping

| Workstream | Validation Types |
|------------|-----------------|
| WS1: Baseline & rubric | Framework (no validation type — sets up the system) |
| WS2: Scenario packs | Input for Type 1 |
| WS3: Layer-by-layer | Executes Type 1 + Type 4 |
| WS4: Negative/adversarial | Executes Type 2 |
| WS5: Real micro-pilot | Executes Type 3 |
| WS6: Drift & hardening | Fixes from Types 1-4, re-validates |
| WS7: Final certification | Aggregates all evidence → verdict |
