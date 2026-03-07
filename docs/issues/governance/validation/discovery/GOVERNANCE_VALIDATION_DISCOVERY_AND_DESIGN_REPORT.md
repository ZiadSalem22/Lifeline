# Governance Validation Discovery and Design Report

## 1. Executive Summary

This pass inspected the current governance system only and designed a practical validation framework for the two governance domains that already exist in Lifeline:

- documentation governance
- CI/CD governance

This report does not implement validation, does not modify the governance stack, and does not run real validation. Its purpose is to define how a later governance-validation phase should be planned and executed.

The current repo is mature enough to move into governance validation planning because both target domains already have a layered governance stack with clear artifacts:

- instruction-level rules
- skill-level rules
- agent-level responsibilities
- team-level coordination
- workflow-level execution sequences

The strongest validation approach is a scenario-based model with explicit pass/fail criteria, expected outputs, anti-pattern detection, and a small later real-world CI/CD sanity path. The recommended implementation path is a four-workstream validation program:

1. locked-input and rubric setup
2. documentation-governance scenario validation
3. CI/CD-governance scenario validation
4. synthesis, drift analysis, and hardening recommendations

## 2. Scope and Locked Inputs

This discovery/design pass is intentionally limited.

### In scope

Only these governance domains are in scope:

- documentation governance
- CI/CD governance

Only design work is in scope:

- identify current governance surfaces
- define what can be validated
- define validation scenarios
- define expected outputs and rubrics
- define layer-by-layer checks
- define negative tests
- define a safe real-world CI/CD sanity-check concept
- define where later validation artifacts should live

### Out of scope

The following are explicitly out of scope for this pass:

- implementing a validation system
- modifying skills, agents, teams, workflows, or instructions
- running actual governance validation
- expanding governance into new domains
- changing production deployment
- changing documentation structure

### Locked authoritative inputs

The current design assumes the following existing governance surfaces are authoritative inputs.

#### Documentation governance

- .github/copilot-instructions.md
- .github/instructions/docs-governance.instructions.md
- .github/skills/documentation-governance.md
- .github/agents/documentation-governance-agent.md
- .github/teams/documentation-governance-team.md
- .github/workflows-governance/documentation-governance-workflow.md
- docs/reference/REPORT_OUTPUT_POLICY.md
- docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md
- docs/templates/docs-update-checklist.md
- docs/templates/change-impact-matrix.md
- docs/README.md
- docs/issues/README.md
- docs/issues/report-history/README.md

#### CI/CD governance

- .github/skills/cicd-governance.md
- .github/agents/cicd-governance-agent.md
- .github/teams/cicd-governance-team.md
- .github/workflows-governance/cicd-governance-workflow.md
- .github/instructions/operations-docs.instructions.md
- .github/instructions/architecture-docs.instructions.md
- docs/operations/DEPLOY_BRANCH_CD.md
- docs/operations/deployment-verification-and-smoke-checks.md
- docs/reference/ENGINEERING_SKILLS.md
- docs/reference/ENGINEERING_AGENTS.md
- docs/reference/ENGINEERING_TEAMS.md
- docs/reference/ENGINEERING_WORKFLOWS.md

### Locked production-model assumptions for CI/CD validation

The later validation plan should treat the following as fixed baseline truths unless the repository intentionally changes them first:

- `main` is the integration/development branch
- `deploy` is the production deployment branch
- production deployment is triggered by pushes to `deploy`
- deployment path is GitHub Actions -> VPS -> release directories -> Docker Compose -> Nginx
- production host is `187.124.7.88`
- deploy root is `/opt/lifeline`
- active symlink is `/opt/lifeline/current`
- shared env file is `/opt/lifeline/shared/.env.production`
- the application must remain privately bound to `127.0.0.1:3020`
- public traffic is served through Nginx at `https://lifeline.a2z-us.com`
- Azure-era deployment paths must not re-enter the active production model

## 3. Current Governance Surfaces Available for Validation

The current governance stack is sufficiently layered to support structured validation.

### A. Instruction layer

This layer defines stable repo rules and routing constraints.

For documentation governance, the strongest instruction artifacts are:

- docs-domain separation rules
- report/output hygiene rules
- root-level exception rules
- routing rules for frontend, backend, API, product, data-model, architecture, and operations docs

For CI/CD governance, the strongest instruction artifacts are:

- operations docs as the source of truth for deployment/runtime procedures
- architecture docs as the source of truth for runtime topology and durable deployment assumptions
- ADR triggers for durable deployment-model changes

### B. Skill layer

The skill layer contains the most concentrated rule logic.

Documentation-governance skill validates well because it already defines:

- source-of-truth hierarchy
- domain map
- routing heuristics
- ADR heuristics
- root-clutter anti-patterns
- concrete examples of correct routing

CI/CD-governance skill validates well because it already defines:

- deployment invariants
- sensitive boundaries for secrets
- smoke-check preservation expectations
- rollback-preservation expectations
- public/private network boundary expectations
- explicit anti-patterns such as public bind exposure and Azure-path reintroduction

### C. Agent layer

The agent layer is suitable for validation because it defines expected decision outputs.

Documentation-governance agent already implies outputs such as:

- docs impact map
- primary and secondary docs targets
- ADR-needed signal
- report/output placement decision
- missing-doc warnings

CI/CD-governance agent already implies outputs such as:

- risk assessment
- drift warnings
- smoke-check preservation notes
- secret-boundary warnings
- docs and ADR update signals

### D. Team layer

The team layer can be validated for coordination completeness rather than low-level rule knowledge.

Documentation-governance team should prove that it coordinates:

- multi-domain routing
- missing-doc detection
- report hygiene
- ADR escalation

CI/CD-governance team should prove that it coordinates:

- deploy-model review
- secret-boundary review
- smoke-check review
- runtime-topology preservation
- operations and architecture doc impact detection

### E. Workflow layer

The workflow layer is the strongest place to validate repeatability.

Documentation workflow already defines a review sequence from change inspection through docs routing and artifact placement.

CI/CD workflow already defines a review sequence from change inspection through:

- production-model impact detection
- risk assessment
- smoke-check verification
- secret-boundary verification
- deploy/release assumption verification
- docs/ADR impact evaluation

### F. Supporting canonical docs

The documentation and operations docs materially strengthen validation because they provide comparison targets outside the governance markdown itself. That matters because later validation should test not only whether governance text exists, but whether it remains aligned with:

- runtime topology docs
- deployment verification docs
- report output policy
- documentation ownership and templates

## 4. Validation Goals and Success Criteria

The validation system should answer one central question:

Does the current governance stack reliably produce correct, consistent, non-destructive guidance when exposed to realistic repository changes?

### Primary goals

1. verify that each governance domain has enough specificity to guide review decisions
2. verify that the four governance layers remain internally aligned
3. verify that expected outputs are concrete, not vague
4. verify that anti-patterns are detected reliably
5. verify that documentation and CI/CD governance do not drift away from current repo reality
6. verify that future validation artifacts themselves respect report hygiene

### Success criteria

A governance domain should be considered validation-ready if most scenarios show all of the following:

- correct authoritative sources are identified
- correct primary and secondary targets are identified
- known invariants are preserved
- explicit warnings are produced for anti-patterns
- missing-doc or ADR implications are surfaced when appropriate
- output routing decisions respect the non-root policy
- different layers do not materially contradict each other

### Failure criteria

A scenario should be considered failed if any of the following occur:

- wrong domain routing is recommended
- a required docs or ops target is omitted
- a known deployment invariant is missed
- a structural/ADR-worthy change receives no escalation
- root-level report sprawl is allowed implicitly
- smoke-check weakening is not flagged
- secret boundary violations are not flagged
- Azure-era deployment assumptions are tolerated without warning
- workflow-level guidance contradicts skill-level rules

## 5. Recommended Validation Model

The recommended model is a locked-input, scenario-driven, layer-by-layer review framework.

### Model structure

For each scenario, the later validation run should define:

1. scenario prompt
2. changed surfaces or simulated diff summary
3. locked authoritative references allowed for judgment
4. expected governance outputs
5. required warnings
6. pass/fail rubric
7. notes on ambiguity or drift

### Scoring recommendation

Use a simple weighted rubric instead of a vague narrative score.

Suggested rubric per scenario:

- authoritative source identification: 20%
- routing/invariant correctness: 25%
- completeness of expected outputs: 20%
- anti-pattern detection: 20%
- storage/output hygiene correctness: 10%
- ADR/drift awareness: 5%

### Suggested verdict bands

- Pass: 90-100
- Pass with drift warnings: 75-89
- Needs hardening: 60-74
- Fails validation: below 60

### Validation object levels

Each scenario should be judged at three levels:

- domain-level correctness
- layer-level consistency
- repo-reality alignment

That keeps the later phase from validating markdown in isolation.

### Recommended evidence format

Each scenario result should capture:

- scenario id
- domain
- target layers exercised
- expected outputs
- observed outputs
- pass/fail result
- drift notes
- hardening recommendation if needed

## 6. Recommended Scenario Pack Design

The most practical pack is a mixed portfolio of synthetic-but-realistic repo changes.

### Scenario-pack structure

Recommend three scenario groups per domain:

1. baseline expected-good scenarios
2. ambiguity/stress scenarios
3. negative/anti-pattern scenarios

### Documentation-governance scenario themes

Recommended baseline scenarios:

1. frontend UX change affecting only screen behavior
2. backend business-rule change affecting product and backend docs
3. API contract change affecting API and backend docs
4. schema/migration change affecting data-model and backend docs
5. deployment verification change affecting operations docs and possibly architecture docs
6. explicitly requested singular final report requiring justified root placement

Recommended ambiguity scenarios:

7. mixed UX plus backend behavior change requiring multiple docs domains
8. business-rule change that superficially looks like an API-only change
9. durable deployment-model change that should trigger ADR evaluation
10. issue-history artifact set that should be compacted rather than retained in root

### CI/CD-governance scenario themes

Recommended baseline scenarios:

11. deploy workflow change that preserves all current invariants
12. smoke-check expansion with no secret-boundary regression
13. rollback improvement that preserves release-model behavior
14. documentation-only refresh of deployment/runtime docs after infra clarification

Recommended ambiguity scenarios:

15. compose/runtime change that touches both operations and architecture surfaces
16. workflow change that appears harmless but weakens one smoke check
17. deployment secret handling refactor that must keep runtime secrets on VPS only
18. runtime topology wording change that could accidentally normalize public binding

### Pack size recommendation

A first planning pass should target 12 to 18 total scenarios, split roughly evenly:

- 6 to 9 documentation-governance scenarios
- 6 to 9 CI/CD-governance scenarios

That is large enough to expose drift without becoming hard to review.

## 7. Layer-by-Layer Validation Design

Each layer should be validated for a different responsibility.

### A. Skill validation

Purpose:

- test whether the skill contains sufficient rule specificity

Check for:

- clear sources of truth
- correct invariant list
- explicit anti-patterns
- usable routing heuristics
- examples that match current repo reality

Documentation skill should be considered strong if it consistently distinguishes:

- frontend vs backend vs API vs product
- operations vs architecture
- final vs temporary reports

CI/CD skill should be considered strong if it consistently preserves:

- deploy branch model
- VPS release model
- loopback bind requirement
- smoke checks
- secret boundary
- rollback expectation

### B. Agent validation

Purpose:

- test whether the agent converts rules into explicit review outputs

Check for:

- concrete output structure
- correct escalation behavior
- missing-doc or drift warnings
- no reliance on vague statements like "update docs as needed"

### C. Team validation

Purpose:

- test whether grouped responsibilities remain complete and coherent

Check for:

- no missing responsibility gaps
- no contradiction with skill or agent rules
- correct coordination of multi-surface changes
- explicit handling of report hygiene or deployment-doc sync where needed

### D. Workflow validation

Purpose:

- test whether the execution sequence is complete and ordered correctly

Check for:

- inspection before routing/judgment
- explicit warning emission points
- explicit report/output placement decisions where relevant
- explicit docs/ADR evaluation points where relevant
- no skipped secret or smoke-check review in CI/CD flow

### E. Cross-layer consistency validation

For each scenario, validate whether:

- instruction rules align with skill rules
- skill rules align with agent outputs
- agent outputs align with team responsibilities
- team responsibilities align with workflow sequence
- workflow outputs still align with canonical docs

This is likely the highest-value part of the future validation program.

## 8. Negative-Test Design

Negative tests should deliberately try to break the governance system.

### Documentation-governance negative tests

1. route a frontend UX change only to backend docs
2. route a business-rule change only to API docs
3. allow multiple temporary workstream reports to remain in root
4. treat `docs/archive/` as the default destination for active execution artifacts
5. ignore ADR evaluation for a durable governance-model change
6. ignore multi-domain impact on a cross-cutting feature change

Expected behavior:

- incorrect routing should be flagged explicitly
- missing domains should be named explicitly
- root-clutter risk should be flagged explicitly
- archive misuse should be flagged explicitly
- ADR omission should be flagged explicitly

### CI/CD-governance negative tests

1. reintroduce public app bind instead of loopback bind
2. move runtime secrets into the repository or workflow env
3. weaken or remove public health/homepage verification
4. weaken rollback assumptions or release preservation
5. normalize Azure-era deployment assumptions in active docs or workflow changes
6. change deploy trigger semantics without updating operations docs
7. change runtime topology language without architecture-doc review

Expected behavior:

- each case should produce a hard warning, not a soft suggestion
- secret-boundary and public-bind regressions should be treated as critical failures
- smoke-check regression should be treated as a validation failure
- drift between workflow behavior and operations docs should be treated as failure or at minimum "needs hardening"

### Adversarial wording tests

Later validation should also include wording-based traps:

- vague prompts that hide a business-rule change inside transport language
- vague prompts that call a temporary report a "final summary"
- vague prompts that describe a runtime exposure change as a "simplification"

This matters because the governance stack must resist ambiguity, not only obvious mistakes.

## 9. Real-World CI/CD Sanity-Check Design

The future real-world check should be minimal, safe, and explicitly non-destructive.

### Purpose

Confirm that the CI/CD governance rules remain grounded in the real production path without introducing deployment risk.

### Recommended design

Use one controlled later scenario that inspects, but does not redesign, the current production delivery model.

The sanity path should verify that a proposed benign CI/CD change would still preserve:

- deploy-branch trigger model
- release-directory model
- current symlink rollback behavior
- VPS-side env-file boundary
- loopback-only bind requirement
- public health and homepage smoke checks
- required docs synchronization points

### Safe execution characteristics

The later real-world validation should:

- avoid secret rotation
- avoid topology changes
- avoid host changes
- avoid port changes
- avoid rollback-path changes
- avoid Compose service renaming unless already prepared elsewhere

### Recommended evidence for that later check

Capture only:

- whether the proposed change preserves invariants
- whether documentation surfaces stay aligned
- whether smoke-check language remains intact
- whether the governance stack emits the right warnings or approvals

This should be treated as a sanity-check case, not as a production experiment program.

## 10. Recommended Storage and Artifact Structure

Future governance validation artifacts must follow the non-root report hygiene policy.

### Root rule

Do not use the repo root as the working home for validation outputs.

This report was originally generated at repo root because that earlier pass explicitly required it there. It has since been relocated into scoped governance issue history under the artifact-routing correction pass.

### Recommended storage pattern for later phases

Preferred later structure:

- `docs/issues/governance/validation/planning/`
- `docs/issues/governance/validation/implementation/`
- `docs/issues/governance/validation/final/`

If that narrower initiative folder is not created, the fallback default should remain:

- `docs/issues/report-history/unscoped/`

### Artifact routing recommendation

- planning prompts and scenario drafts -> `docs/issues/governance/validation/planning/`
- executed scenario results -> `docs/issues/governance/validation/implementation/`
- cross-layer drift summaries and final synthesis -> `docs/issues/governance/validation/final/`
- temporary notes/checkpoints -> the matching scoped `docs/issues/governance/validation/...` folder or fallback to `docs/issues/report-history/unscoped/`
- only one explicit permanent top-level artifact, if later approved, may live at root

### Output hygiene requirement for the later phase

The validation program should itself be scored on whether it respects report hygiene. A governance-validation effort that recreates root clutter would fail one of the governance systems it is supposed to validate.

## 11. Risks and Watchouts

### 1. False validation confidence

A markdown-only review could make the governance stack look stronger than it is. Future validation must compare governance outputs against actual repo surfaces and canonical docs.

### 2. Over-broad scope expansion

If later planning expands into frontend-refactor governance, backend-refactor governance, or generalized AI governance too early, the first validation pass will lose focus.

### 3. Ambiguity without locked baselines

If later scenario evaluators do not lock the current deployment model and current docs policy first, results will be inconsistent.

### 4. Layer confusion

The validation plan must remember that:

- skills encode rules
- agents encode role outputs
- teams encode coordination
- workflows encode ordered execution

Testing all layers the same way will reduce signal quality.

### 5. Root-clutter regression during validation itself

A badly run validation program could recreate the exact report-sprawl problem that documentation governance now forbids.

### 6. Under-testing ambiguity

If later validation checks only obvious anti-patterns, it may miss subtle failures such as incomplete docs routing, missing ADR escalation, or wording drift around public/private runtime boundaries.

## 12. Recommendation for the Governance Validation Planning Prompt

The next planning prompt should request a concrete implementation plan for governance validation without yet changing the current governance stack.

That planning prompt should require:

1. a locked scenario inventory for only the two current governance domains
2. a rubric for pass/fail and drift classification
3. a result template for each scenario
4. a cross-layer consistency checklist
5. a negative-test matrix
6. a minimal real-world CI/CD sanity-check plan
7. an artifact-routing plan under `docs/issues/...`
8. a recommendation for which scenarios should be run first

### Recommended planning-phase workstreams

The next planning phase should be split into four major workstreams:

1. validation inputs and rubric design
2. documentation-governance scenario planning
3. CI/CD-governance scenario planning
4. results format, storage, and execution governance

### Final recommendation

The repository is ready to move to governance validation planning.

It is not yet time to implement or run the validation system, but the current governance stack is concrete enough to support a disciplined planning phase built around locked scenarios, explicit rubrics, and non-root artifact handling.
