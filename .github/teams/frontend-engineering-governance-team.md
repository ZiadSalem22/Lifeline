# Frontend Engineering Governance Team

## Purpose

Coordinate frontend engineering governance responsibilities across Lifeline's React frontend.

This team ensures that component architecture, state management, UI/UX quality, accessibility, and responsive behavior are reviewed consistently and that findings integrate with documentation, code quality, and other governance families.

## When to use it

Use this team when:
- a frontend change affects multiple components or pages
- a pull request needs frontend engineering governance review
- component restructuring or state architecture changes need coordinated assessment
- UI/UX quality, accessibility, or responsive behavior needs evaluation
- frontend findings need to be consolidated with code quality findings

## Skills it relies on

- `.github/skills/frontend-engineering-governance.md`
- `.github/skills/code-quality-governance.md`

## Agents it coordinates

- `.github/agents/frontend-builder-agent.md`
- `.github/agents/frontend-review-agent.md`

## Responsibilities

- enforcing component boundary discipline across the frontend
- enforcing state ownership rules
- enforcing provider/context usage patterns
- verifying UI state completeness (loading, empty, error)
- verifying accessibility compliance
- verifying responsive behavior
- detecting shell/navigation coherence issues
- consolidating frontend review findings with code quality findings
- determining when frontend changes also require:
  - documentation updates (`docs/frontend/`, `docs/product/`, `docs/features/`)
  - backend governance involvement (if API contracts are implied)
  - refactor governance (if larger frontend restructuring is needed)
  - ADR updates (if frontend architecture decisions are durable)

## Inputs it expects

- changed frontend files
- description of the frontend change
- code quality review findings when available
- screen/flow context when known

## Outputs it produces

- consolidated frontend engineering assessment
- component boundary findings
- state ownership findings
- UI/UX quality assessment
- accessibility findings
- responsive behavior findings
- documentation update requirements
- cross-family trigger signals

## Team role versus agent role

- the skill provides rule-level frontend knowledge
- the builder agent guides clean frontend implementation
- the review agent assesses completed frontend work
- this team coordinates grouped frontend-governance responsibility and consolidates findings

## What it must not do

- override backend governance for API-related decisions
- mandate visual design without UX justification
- mandate TypeScript migration for individual features
- block changes for aesthetic disagreements
- perform the actual code review itself — it coordinates and consolidates
