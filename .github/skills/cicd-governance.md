# Skill: cicd-governance

## Purpose

Protect Lifeline's current production deployment model and prevent CI/CD or deployment changes from breaking the deploy-branch VPS workflow.

This skill exists to preserve the repo's working GitHub Actions → VPS → release-directory → Docker Compose → Nginx deployment path.

## Scope

Use this skill to review or design changes involving:
- GitHub Actions workflows
- production deployment scripts
- Compose or Docker production files
- deploy-branch behavior
- production smoke checks
- GitHub deployment secrets versus VPS runtime secrets
- Nginx or host-routing assumptions tied to production deployment

## When to use it

Use this skill when a change touches:
- `.github/workflows/`
- `compose.production.yaml`
- `compose.yaml`
- `Dockerfile`
- `deploy/scripts/`
- `deploy/nginx/`
- deployment-related docs under `docs/operations/`
- production verification or rollback behavior

## Sources of truth

Consult these first:
- `.github/workflows/deploy-production.yml`
- `compose.production.yaml`
- `Dockerfile`
- `deploy/scripts/`
- `deploy/nginx/`
- `docs/operations/DEPLOY_BRANCH_CD.md`
- `.github/instructions/operations-docs.instructions.md`

Host-side runtime source of truth:
- `/opt/lifeline/shared/.env.production`

## What this skill must know

- `main` is the normal development and integration branch.
- `deploy` is the production deployment branch.
- Pushes to `deploy` trigger production deployment.
- GitHub Actions is the active production deployment mechanism.
- Production deployment targets the VPS at `187.124.7.88`.
- Deploy root is `/opt/lifeline`.
- Release layout is:
  - `/opt/lifeline/releases`
  - `/opt/lifeline/shared`
  - `/opt/lifeline/current`
- Production runtime secrets stay on the VPS.
- The Node app must remain privately bound on `127.0.0.1:3020`.
- Nginx proxies `https://lifeline.a2z-us.com` to that internal app bind.
- Docker and Compose are the active production runtime model.
- Azure-era deployment paths must not be reintroduced.

## Safety rules

### Safe CI/CD changes should preserve
- the deploy-branch trigger model
- the release-directory deployment model
- host-side runtime secrets on the VPS
- smoke checks for:
  - public health check
  - homepage response
  - container health
  - private bind verification

### Sensitive files and surfaces
- `.github/workflows/deploy-production.yml`
- `compose.production.yaml`
- `Dockerfile`
- `deploy/scripts/apply-release.sh`
- `deploy/nginx/lifeline.a2z-us.com.conf`
- GitHub `production` environment secrets
- `/opt/lifeline/shared/.env.production`

## Validation heuristics

When changing CI/CD or deployment logic, verify:
- deploys still trigger only from `deploy`
- release artifacts still land under `/opt/lifeline/releases/<release-id>`
- `/opt/lifeline/current` still switches to the new release
- Compose still runs against `compose.production.yaml`
- runtime secrets are still read from `/opt/lifeline/shared/.env.production`
- the app is still privately bound to `127.0.0.1:3020`
- public health and homepage checks still exist
- failure diagnostics still exist

## Secret-governance heuristics

GitHub secrets should contain only deployment transport or automation secrets such as:
- VPS host
- VPS user
- SSH private key
- SSH port
- known hosts data

Do not move application runtime secrets into:
- git
- workflow files
- repository secrets unless they are strictly deployment-transport secrets

Runtime app secrets belong on the VPS in `/opt/lifeline/shared/.env.production`.

## Documentation routing rules

If CI/CD or deployment changes occur, update:
- `docs/operations/`

Also update when applicable:
- `docs/architecture/` if runtime topology or deployment shape changes
- `docs/adr/` if the deployment model changes durably

## What this skill must not do

- reintroduce Azure deployment workflows
- expose the Node app publicly on all interfaces
- move runtime secrets into git
- remove smoke checks that protect production verification
- break the release-based rollback model
- treat CI/CD changes as documentation-free changes

## Practical checklist

- Confirm the change still fits the `main` / `deploy` branch model.
- Confirm production is still deployed by GitHub Actions.
- Confirm release layout is unchanged or intentionally evolved.
- Confirm runtime secrets remain VPS-side.
- Confirm public health, homepage, container health, and private bind checks remain intact.
- Confirm `docs/operations/` is updated if workflow or deployment behavior changed.
- Confirm no Azure-era deployment path is being restored.

## Examples

- editing smoke checks in the workflow → validate health URL, homepage verification, and bind checks remain intact; update `docs/operations/`
- changing Compose production services → validate private bind, host-side env usage, and rollback assumptions; maybe update `docs/architecture/`
- changing GitHub deployment secrets → ensure they remain deployment-only secrets and do not absorb runtime app secrets
