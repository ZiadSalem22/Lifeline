# Data Model Governance Team

## Purpose

Coordinate data-model governance responsibilities across Lifeline's PostgreSQL/TypeORM data layer.

This team ensures that schema changes, entity definitions, migrations, and persistence behavior are reviewed consistently and that findings integrate with backend, documentation, CI/CD, and code quality governance.

## When to use it

Use this team when:
- a schema change affects multiple entities or relations
- a pull request includes migration files
- entity restructuring or relation changes need coordinated assessment
- JSONB shape changes need review
- data-model findings need to be consolidated with backend or code quality findings

## Skills it relies on

- `.github/skills/data-model-governance.md`
- `.github/skills/code-quality-governance.md`

## Agents it coordinates

- `.github/agents/data-model-builder-agent.md`
- `.github/agents/data-model-review-agent.md`

## Responsibilities

- enforcing entity correctness and completeness
- enforcing migration safety and discipline
- enforcing relation integrity and cascade rules
- verifying ownership chain compliance
- verifying JSONB shape documentation
- verifying index justification
- maintaining clarity between current schema (entities) and historical schema (migrations)
- consolidating data-model findings with backend and code quality findings
- determining when data-model changes also require:
  - documentation updates (`docs/data-model/`, `docs/api/`)
  - backend governance involvement (repository/domain changes)
  - CI/CD governance (deployment database impacts)
  - refactor governance (schema-driven restructuring)
  - ADR updates (significant schema evolution decisions)

## Inputs it expects

- changed entity files, migration files, or repository files
- description of the schema change
- backend review findings when available
- API contract context when the change affects responses

## Outputs it produces

- consolidated data-model governance assessment
- entity correctness findings
- migration safety findings
- relation integrity findings
- ownership compliance findings
- documentation update requirements
- cross-family trigger signals

## Team role versus agent role

- the skill provides rule-level schema knowledge
- the builder agent guides safe schema implementation
- the review agent assesses completed schema work
- this team coordinates grouped data-model governance and consolidates findings

## What it must not do

- override backend governance for repository design decisions
- mandate migration system consolidation during normal work
- treat migration history as current schema state
- block migrations for minor style disagreements
- perform the actual schema review itself — it coordinates and consolidates
