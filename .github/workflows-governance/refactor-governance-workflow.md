# Refactor Governance Workflow

## Purpose

Define the repeatable execution path for refactor governance in Lifeline.

This workflow sits above the refactor-governance skill, agents, and team and turns them into a practical sequence for planning, executing, and reviewing refactoring work.

## Built on

- `.github/skills/refactor-governance.md`
- `.github/skills/code-quality-governance.md`
- `.github/agents/refactor-builder-agent.md`
- `.github/agents/refactor-review-agent.md`
- `.github/teams/refactor-governance-team.md`

## Inputs

- proposed or completed refactoring change
- changed files and their previous state
- refactor scope statement and justification
- preserved-behavior statement
- domain-specific review findings when available
- regression test context when available

## Workflow sequence

### Pre-refactor (builder guidance)
1. Inspect the proposed refactor scope.
2. **Conformance check**: read sibling files to understand existing patterns and conventions.
3. **Smell identification**: identify which smell family is triggering the refactor.
4. **Refactoring type**: classify as preparatory / comprehension / litter-pickup.
5. Verify the justification is specific and valid.
6. Apply **Rule of Three**: is extraction warranted or premature?
7. Recommend decomposition strategy (which concerns to separate, in what order).
8. Map identified smell to named refactoring transformation from the catalog.
9. Recommend extraction approach (what to extract, where to place it).
10. Identify behaviors that must be preserved.
11. Draft preserved-behavior statement.
12. Identify regression test requirements.
13. Recommend change sequencing (incremental steps following safe refactoring loop: test → refactor → test → commit).
14. For large-scale refactors, recommend **Branch by Abstraction** strategy.
15. Identify dead code cleanup opportunities.
16. Define scope boundaries.
17. Identify applicable domain governance constraints.
18. Emit refactor plan with safety guidance.

### Post-refactor (review)
1. Inspect the changed files.
2. **Conformance check**: verify refactored code matches sibling file patterns.
3. Verify preserved-behavior statement exists and is accurate.
4. Assess behavior preservation: are stated behaviors actually preserved?
5. **Smell assessment**: did the refactor resolve the identified smell or just move it?
6. **Refactoring type verification**: is the type classified and accurate?
7. Assess decomposition quality: clear names, focused files, simpler originals.
8. Assess extraction quality: clean abstraction, multiple consumers, correct scope.
9. Assess scope discipline: stayed within stated scope, no creep.
10. Assess incremental discipline: independently reviewable steps.
11. **Safe refactoring loop**: was test → refactor → test → commit followed?
12. **Dead code review**: was dead code removed or flagged?
13. Apply domain-specific governance rules (frontend, backend, data-model) as applicable.
14. Apply code quality governance for general readability, naming, and complexity.
15. Determine whether the refactor genuinely improved the codebase.
16. **Cross-cutting analysis** (multi-file refactors): verify consistency across all affected files and consumers.
17. Classify each finding with severity: CRITICAL / HIGH / MEDIUM / LOW.
18. Emit refactor review findings in structured format (File / Severity / Category / Why / Recommendation).
19. Emit review verdict: Approve / Request changes / Needs discussion.
20. Log newly discovered issues as separate refactor candidates.
21. Determine cross-family triggers:
    - Documentation governance: if module boundaries or APIs changed
    - Domain-specific governance: if domain rules were affected
    - ADR: if the structural change is durable and significant

## Rules it enforces

- Every refactor must have a preserved-behavior statement
- Structural changes must preserve behavior unless change is explicitly intended
- Refactors must be incremental — no big-bang changes
- Extraction must create cleaner abstractions, not worse ones
- Scope must be defined before starting and maintained throughout
- Newly discovered issues are logged separately, not added to scope
- Regression tests must be run or considered
- Justification must be specific (not "feels cleaner")
- Domain-specific governance rules must be respected

## Outputs it produces

- Refactor governance assessment (pass / conditional pass / fail)
- Behavior preservation verification
- Decomposition/extraction quality findings
- Scope discipline assessment
- Genuine improvement assessment
- Regression coverage assessment
- Cross-family trigger signals
- Separate refactor candidate issues discovered during review

## Failure modes and warnings

Emit warnings when:
- preserved-behavior statement is missing or vague
- behavior change is detected without explicit acknowledgment
- extraction creates an abstraction that is harder to understand than the original
- scope creep is detected (unrelated changes mixed in)
- big-bang changes touch many unrelated files
- regression tests were not run or are missing for the affected area
- justification is vague or preference-based
- code was moved but structure was not genuinely improved
- domain-specific governance rules were violated during refactoring

## Anti-patterns this workflow prevents

- "while we're here" scope expansion
- big-bang refactors that are unreviewable
- extractions that create worse abstractions
- missing preserved-behavior statements
- refactors justified by style preference alone
- behavior changes hidden in structural changes
- refactoring and feature work mixed in one PR
- ignoring regression risk
- premature extraction before Rule of Three
- leaving dead code behind after restructuring
- half-migrated Branch by Abstraction without cleanup
- combining multiple refactoring operations without intermediate testing
- missing refactoring type classification
- ignoring code smells that triggered the refactor need
