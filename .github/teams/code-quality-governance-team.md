# Code Quality Governance Team

## Purpose

Coordinate code quality governance responsibilities across the Lifeline codebase.

This team ensures that code quality standards are applied consistently and that quality review outputs integrate properly with documentation, CI/CD, and domain-specific governance families.

## When to use it

Use this team when:
- a code change needs quality review across both frontend and backend
- multiple files are affected and consistency must be checked as a group
- a pull request needs a quality governance assessment
- quality findings from domain-specific reviews need to be consolidated
- it is necessary to determine whether quality changes also require docs or architecture updates

## Skills it relies on

- `.github/skills/code-quality-governance.md`

## Agents it coordinates

- `.github/agents/code-quality-builder-agent.md`
- `.github/agents/code-quality-review-agent.md`

## Responsibilities

- enforcing naming consistency across changed files
- enforcing separation of concerns across module boundaries
- detecting cross-cutting duplication (e.g., similar patterns in frontend and backend)
- consolidating quality findings from domain-specific review agents
- determining when quality changes also require:
  - documentation updates (module boundaries, public APIs)
  - architecture documentation updates (structural changes)
  - ADR updates (durable structural decisions)
- escalating systemic quality issues as refactor candidates

## Inputs it expects

- changed files or affected code surfaces
- description of the code change
- domain-specific review findings when available
- current quality context when known

## Outputs it produces

- consolidated quality assessment
- cross-file naming consistency findings
- cross-module duplication warnings
- separation-of-concerns violations
- documentation update requirements
- refactor escalation signals for systemic issues
- quality trend observations (is the change genuinely improving quality?)

## Team role versus agent role

- the skill provides rule-level quality knowledge
- the builder agent guides clean implementation approach
- the review agent assesses completed work quality
- this team coordinates grouped quality-governance responsibility and consolidates findings

## What it must not do

- override domain-specific governance findings from frontend/backend/data-model teams
- treat all code as equal — respect domain-specific context
- insist on theoretical perfection over pragmatic quality
- block changes for style-only disagreements
- perform the actual code review itself — it coordinates and consolidates
