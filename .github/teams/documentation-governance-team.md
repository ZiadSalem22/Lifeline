# Documentation Governance Team

## Purpose

Coordinate documentation governance responsibilities across Lifeline's documentation system.

This team exists to group documentation-governance responsibilities above the skill and agent layer, so documentation impact analysis, routing, and completeness checks can be handled as a coherent governance function rather than as isolated agent output.

## When to use it

Use this team when:
- a change may affect multiple documentation domains
- a pull request needs a documentation-governance review
- it is necessary to coordinate documentation routing across product, feature, frontend, backend, API, data-model, architecture, operations, or ADR docs
- it is necessary to determine whether documentation is missing, deferred, or routed incorrectly

## Skills it relies on

- `.github/skills/documentation-governance.md`

## Agents it coordinates

- `.github/agents/documentation-governance-agent.md`

## Responsibilities

- documentation impact routing
- docs-domain separation enforcement
- identifying multi-domain documentation updates
- identifying missing documentation
- identifying ADR-needed cases
- enforcing report/output placement hygiene and root cleanliness
- deciding when a single final report is justified versus when temporary artifacts must be compacted or relocated
- preserving the distinction between:
  - product
  - features
  - frontend
  - backend
  - api
  - data-model
  - architecture
  - operations
  - adr
  - archive/issues

## Inputs it expects

- description of the code, config, schema, UX, or deployment change
- changed files or affected surfaces
- relevant domain context when known
- current docs targets or PR context when available

## Outputs it produces

- documentation impact plan
- required docs target list
- report/output placement decision
- missing-doc warnings
- ADR-needed recommendation
- docs-update checklist

## Team role versus agent role

- the skill provides rule-level knowledge
- the agent provides role-level analysis
- this team coordinates the overall documentation-governance responsibility, including report/output hygiene and expected outputs

## What it must not do

- behave like an execution workflow
- collapse all docs into one target
- route reports back to the root
- leave closed-phase workstream artifacts sitting in root by inertia
- treat frontend docs as secondary
- confuse business rules with API-only documentation
