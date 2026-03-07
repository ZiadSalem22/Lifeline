# Refactor Governance Team

## Purpose

Coordinate refactor governance responsibilities across the Lifeline codebase.

This team ensures that refactoring work preserves behavior, improves structure genuinely, stays within scope, and respects all applicable domain governance rules.

## When to use it

Use this team when:
- a refactoring initiative affects multiple files or modules
- a pull request contains structural changes that need behavior verification
- decomposition or extraction quality needs assessment
- scope discipline needs enforcement across a multi-step refactor
- refactor findings need to be consolidated with domain-specific governance findings

## Skills it relies on

- `.github/skills/refactor-governance.md`
- `.github/skills/code-quality-governance.md`

## Domain-specific skills it consults

- `.github/skills/frontend-engineering-governance.md` for frontend refactors
- `.github/skills/backend-engineering-governance.md` for backend refactors
- `.github/skills/data-model-governance.md` for schema-related refactors

## Agents it coordinates

- `.github/agents/refactor-builder-agent.md`
- `.github/agents/refactor-review-agent.md`

## Responsibilities

- enforcing behavior-preserving discipline across refactors
- enforcing incremental change discipline
- enforcing scope control (no creep)
- verifying decomposition and extraction quality
- verifying preserved-behavior statements
- verifying regression test coverage or expectations
- enforcing smell-to-refactoring mapping accuracy
- enforcing refactoring type classification (preparatory / comprehension / litter-pickup)
- enforcing dead code cleanup discipline
- enforcing safe refactoring loop (test → refactor → test → commit)
- ensuring severity consistency (CRITICAL / HIGH / MEDIUM / LOW) across all findings
- consolidating refactor findings with domain-specific governance findings
- determining when refactors also require:
  - documentation updates (module boundaries, APIs, architecture)
  - domain-specific governance review (frontend, backend, data-model)
  - ADR updates (durable structural decisions)
- escalating discovered issues as separate refactor tasks (not in-scope additions)

## Inputs it expects

- changed files and their previous state
- refactor scope statement and justification
- preserved-behavior statement
- domain-specific review findings when available
- regression test results when available

## Outputs it produces

- consolidated refactor governance assessment
- behavior preservation verification
- scope discipline assessment
- decomposition/extraction quality findings
- genuine improvement assessment
- documentation update requirements
- cross-family trigger signals
- newly discovered issues logged as separate refactor candidates

## Team role versus agent role

- the skill provides rule-level refactor knowledge
- the builder agent guides safe refactor planning and sequencing
- the review agent assesses completed refactor quality
- this team coordinates grouped refactor-governance responsibility and consolidates findings

## What it must not do

- override domain-specific governance for domain rules
- approve scope creep as "while we're here" cleanup
- treat code movement as inherent improvement
- block refactors for style preferences
- approve big-bang refactors that touch many unrelated files
- perform the actual refactor review itself — it coordinates and consolidates
