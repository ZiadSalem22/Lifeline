# CI/CD Sanity Check Plan

## Objective

Run one minimal, harmless, reversible-in-practice sanity check against the live deploy path so CI/CD governance is validated against real production behavior, not only paper scenarios.

## Chosen sanity marker

Use a nonfunctional HTML metadata marker in `client/index.html`:

- meta name: `lifeline-governance-validation`
- content: `2026-03-06-phase-validation`

## Why this marker is safe

- does not change ports
- does not change runtime topology
- does not change Nginx behavior
- does not change secret handling
- does not change rollback behavior
- does not affect app logic
- can be verified from the public homepage source after deployment

## Execution steps

1. verify the current public homepage and database health endpoint are healthy
2. add the harmless metadata marker to `client/index.html`
3. commit the current validation work plus the marker as an intermediate sanity-check commit
4. push the committed state to the remote `deploy` branch
5. wait for deployment to settle
6. verify:
   - the homepage is reachable
   - `/api/health/db` is reachable
   - the public HTML now contains the new metadata marker
   - the existing `lifeline-deployment-path=deploy-branch-vps` marker still exists
7. record the result and any drift notes

## Success criteria

- remote `deploy` branch accepts the push
- public homepage remains available
- public DB health remains healthy
- the new metadata marker is visible in served HTML
- the existing deployment-path marker remains present

## Safety constraints enforced

- no secret changes
- no port changes
- no topology changes
- no rollback changes
- no Nginx changes
- docs and governance changes only, plus the harmless metadata marker
