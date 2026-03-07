# Backend Engineering Governance Team

## Purpose

Coordinate backend engineering governance responsibilities across Lifeline's Node.js/Express backend.

This team ensures that backend layering, service boundaries, error handling, auth safety, and contract discipline are reviewed consistently and that findings integrate with data-model, documentation, CI/CD, and code quality governance.

## When to use it

Use this team when:
- a backend change affects multiple layers (routes, controllers, use-cases, repositories)
- a pull request needs backend engineering governance review
- layer restructuring or service boundary changes need coordinated assessment
- error handling or auth patterns need evaluation across the backend
- backend findings need to be consolidated with code quality or data-model findings

## Skills it relies on

- `.github/skills/backend-engineering-governance.md`
- `.github/skills/code-quality-governance.md`

## Agents it coordinates

- `.github/agents/backend-builder-agent.md`
- `.github/agents/backend-review-agent.md`

## Responsibilities

- enforcing route/controller thinness across the backend
- enforcing use-case boundary clarity
- enforcing repository encapsulation
- enforcing dependency direction rules (inner layers never import outer)
- verifying validation placement (middleware, use-case, domain)
- verifying error handling discipline
- verifying auth and user-scoping safety
- verifying API contract preservation
- verifying security discipline (no hardcoded secrets, sanitized input, auth coverage)
- verifying performance discipline (no N+1, pagination, indexes, timeouts)
- verifying reliability discipline (error handling on I/O, timeouts, resource cleanup)
- ensuring severity levels (CRITICAL/HIGH/MEDIUM/LOW) are applied consistently across findings
- consolidating backend review findings with code quality findings
- determining when backend changes also require:
  - documentation updates (`docs/api/`, `docs/backend/`)
  - data-model governance involvement (entity/repository changes)
  - CI/CD governance (deployment-affecting changes)
  - refactor governance (deeper restructuring needed)
  - ADR updates (durable backend architecture decisions)

## Inputs it expects

- changed backend files
- description of the backend change
- code quality review findings when available
- API contract context when known
- data-model context when relevant

## Outputs it produces

- consolidated backend engineering assessment
- layer discipline findings
- error handling assessment
- auth/user-scoping safety assessment
- contract compliance findings
- documentation update requirements
- cross-family trigger signals

## Team role versus agent role

- the skill provides rule-level backend knowledge
- the builder agent guides clean backend implementation
- the review agent assesses completed backend work
- this team coordinates grouped backend-governance responsibility and consolidates findings

## What it must not do

- override data-model governance for schema/entity decisions
- override frontend governance for shared utilities
- mandate TypeScript migration for individual features
- block changes for layer-purity disagreements when pragmatic exceptions are justified
- perform the actual code review itself — it coordinates and consolidates
