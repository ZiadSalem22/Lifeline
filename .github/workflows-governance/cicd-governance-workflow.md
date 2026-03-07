# CI/CD Governance Workflow

## Purpose

Define the repeatable execution path for CI/CD and deployment governance in Lifeline.

This workflow sits above the CI/CD-governance skill, agent, and team and turns them into a practical review sequence for production-delivery changes.

## Built on

- `.github/skills/cicd-governance.md`
- `.github/agents/cicd-governance-agent.md`
- `.github/teams/cicd-governance-team.md`

## Inputs

- proposed CI/CD or deployment change description
- changed workflow, deployment, Compose, Docker, or Nginx files
- deployment verification or rollback expectations
- operations or architecture docs context when available

## Workflow sequence

1. Inspect the deployment-related change.
2. Detect whether the production delivery model is affected.
3. Assess CI/CD change risk.
4. Verify smoke-check preservation requirements for container health, public health, homepage response, and private-bind verification.
5. Verify secret-boundary rules.
6. Verify deploy-branch and VPS release-model assumptions.
7. Determine whether operations docs, architecture docs, or ADRs must be updated.
8. Emit deployment-governance warnings, conditions, or approval signals.

## Rules it enforces

- `main` remains the normal development/integration branch
- `deploy` remains the production deployment branch
- GitHub Actions remains the active production deployment path
- production remains release-based under `/opt/lifeline/releases` and `/opt/lifeline/current`
- runtime secrets remain on the VPS in `/opt/lifeline/shared/.env.production`
- the Node app remains privately bound on `127.0.0.1:3020`
- Nginx continues proxying `https://lifeline.a2z-us.com` to that private bind
- Azure-era deployment paths must not return

## Outputs it produces

- CI/CD change-risk assessment
- deployment-model drift warnings
- smoke-check preservation checklist covering container health, public health, homepage response, and private-bind verification
- secret-boundary warnings
- deployment-doc update requirements
- docs-alignment warnings when documentation-only deployment clarifications drift from workflow, deploy-script, or runtime-topology reality
- architecture-doc or ADR-needed signals when deployment shape changes materially

## Failure modes and warnings

Emit warnings when:
- deployment changes weaken or remove smoke checks
- runtime secrets are proposed for git or workflow files
- the app bind may become public on all interfaces
- the release-based rollback model is weakened
- Azure-era deployment assumptions are being reintroduced
- deployment changes occur without corresponding operations-doc updates
- runtime-topology or proxy-shape changes occur without corresponding architecture-doc evaluation
- documentation-only deployment clarifications are proposed without re-checking workflow, deploy-script, and runtime-topology sources

## Anti-patterns this workflow prevents

- treating deployment changes as low-risk config edits
- pushing runtime secrets into source control
- breaking the `deploy` branch production model
- removing private-bind verification
- reintroducing Azure-specific production workflow paths
