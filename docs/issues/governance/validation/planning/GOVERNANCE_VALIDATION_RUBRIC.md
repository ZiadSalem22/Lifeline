# Governance Validation Rubric

## Scenario scoring

Each scenario is scored out of 100.

### Weighted dimensions

- authoritative source identification: 20
- routing or invariant correctness: 25
- completeness of expected outputs: 20
- anti-pattern detection: 20
- artifact/output placement correctness: 10
- ADR or drift awareness: 5

## Verdict bands

- Pass: 90-100
- Pass with drift warnings: 75-89
- Needs hardening: 60-74
- Fail: below 60

## Layer-by-layer evaluation rules

### Skill

Check whether rule knowledge is explicit, specific, and aligned with repo reality.

### Agent

Check whether role-level outputs are concrete, structured, and actionable.

### Team

Check whether coordination responsibilities are complete and non-contradictory.

### Workflow

Check whether the ordered sequence catches routing, escalation, and anti-pattern failures before approval.

## Cross-layer drift rule

A scenario cannot score above `Pass with drift warnings` if one layer materially contradicts another, even if individual statements look correct in isolation.

## Hardening trigger rule

Any repeated weakness across two or more scenarios becomes a hardening candidate in Workstream 5.
