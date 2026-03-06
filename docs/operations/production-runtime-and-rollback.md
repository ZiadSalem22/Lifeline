# Production Runtime and Rollback

## Purpose

This document describes the current production runtime shape, deployment environment expectations, and rollback behavior.

## Canonical sources used for this document

- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [compose.production.yaml](../../compose.production.yaml)
- [Dockerfile](../../Dockerfile)
- [deploy/nginx/lifeline.a2z-us.com.conf](../../deploy/nginx/lifeline.a2z-us.com.conf)
- [backend/scripts/start-container.js](../../backend/scripts/start-container.js)
- [docs/operations/DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)

## Current production model

Lifeline uses the `deploy-branch production model`.

The current production target is a VPS that hosts:

- release directories under `/opt/lifeline/releases`
- the active symlink at `/opt/lifeline/current`
- a shared production environment file at `/opt/lifeline/shared/.env.production`
- an Nginx reverse proxy
- Docker containers for the app and PostgreSQL

## Production runtime components

### `lifeline-app`

The application container:

- is built from the repo Dockerfile
- serves the Express API
- serves built frontend assets
- waits for PostgreSQL before startup
- runs migrations before listening

### `lifeline-postgres`

The Postgres container:

- runs `postgres:16-alpine`
- persists data through the named volume `lifeline-postgres-data`
- exposes health through `pg_isready` inside the compose healthcheck

### Nginx

Nginx proxies `lifeline.a2z-us.com` to `http://127.0.0.1:3020`.

That keeps the app container off the public network interface and makes Nginx the public edge.

## Runtime environment expectations

The production compose file expects environment values for:

- PostgreSQL credentials and database name
- auth settings such as Auth0 domain and audience when auth is enabled
- allowed origins and app origins
- logging and SSL behavior
- internal app port mapping through `APP_PORT`

The shared production env file is the main runtime source for those values.

## Production deployment flow summary

At a high level, production deployment does the following:

1. package the `deploy` branch commit
2. upload the release archive to the VPS
3. extract it into a new release directory
4. repoint `/opt/lifeline/current`
5. run `docker compose up -d --build`
6. verify database health, public health, homepage response, and loopback-only app binding

## Automatic rollback behavior

The deploy helper captures the previous active release before switching the symlink.

If deployment fails after the symlink switch:

- the trap handler restores `/opt/lifeline/current` to the previous release
- diagnostic output is collected from Docker and the affected containers
- the deployment exits as failed

## Release retention behavior

The deploy helper keeps only a limited set of recent releases through `KEEP_RELEASES` and prunes older directories while preserving the active and previous release paths.

## Manual rollback

A manual rollback can be performed by:

1. repointing `/opt/lifeline/current` to a previous release directory
2. rerunning the compose startup against that release with the shared production env file

## Operational risks to watch

Important operational assumptions include:

- the app container must stay bound to `127.0.0.1:3020` in production
- the shared env file must exist and be valid
- migrations must succeed before the app can start normally
- the public domain and Nginx proxy target must remain aligned with the compose port mapping

## Related canonical documents

- [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)
- [local-development-and-runtime-setup.md](local-development-and-runtime-setup.md)
- [../architecture/runtime-topology.md](../architecture/runtime-topology.md)
