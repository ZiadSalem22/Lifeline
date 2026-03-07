# CI/CD Governance Team

## Purpose

Coordinate CI/CD and deployment-governance responsibilities across Lifeline's production delivery system.

This team exists to group deployment-governance review above the skill and agent layer so production-delivery assumptions can be protected consistently before workflow automation expands further.

## When to use it

Use this team when:
- a change affects GitHub Actions, deployment scripts, Compose, Docker, or Nginx deployment assumptions
- a change may alter the deploy-branch production model
- a change may affect runtime-secret boundaries or smoke-check expectations
- a pull request needs a CI/CD governance review
- it is necessary to determine whether deployment, operations, architecture, or ADR docs must be updated

## Skills it relies on

- `.github/skills/cicd-governance.md`

## Agents it coordinates

- `.github/agents/cicd-governance-agent.md`

## Responsibilities

- protecting the deploy-branch production model
- protecting GitHub Actions as the active deployment path
- protecting the VPS release model
- protecting the host-secret/runtime-secret boundary
- protecting the private app bind and Nginx proxy shape
- protecting smoke checks and deployment verification expectations
- identifying when CI/CD or deployment changes also require:
  - operations doc updates
  - architecture doc updates
  - ADR updates

## Inputs it expects

- changed workflow, deployment, Compose, Docker, or Nginx files
- description of proposed deployment-model or CI/CD changes
- deployment verification expectations
- affected docs context when known

## Outputs it produces

- CI/CD governance review
- deployment drift warnings
- smoke-check preservation requirements
- secret-boundary warnings
- deployment-doc update requirements
- architecture-doc or ADR-needed signals when runtime topology changes materially

## Team role versus agent role

- the skill provides rule-level deployment governance knowledge
- the agent provides role-level CI/CD risk analysis
- this team coordinates grouped deployment-governance responsibility and review outputs

## What it must not do

- behave like a deployment workflow
- approve public exposure of the Node app
- move runtime secrets into git or workflow files
- reintroduce Azure-era deployment paths
- treat deployment changes as documentation-free changes
