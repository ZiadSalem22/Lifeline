# Step-05 completion: stabilization validation and branch alignment

Date: 2026-03-07

## Scope

This retained final report closes the step-05 stabilization and branch-alignment phase for Lifeline MCP deploy reliability.

## Review result

Kept in scope:

- `deploy/scripts/apply-release.sh`
- `.gitattributes`
- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/operations/production-runtime-and-rollback.md`
- `docs/issues/mcp-server/step-05-cicd-stabilization/**`
- `docs/issues/mcp-server/step-04-production-cutover/final/production-cutover-completion-report.md`

Excluded from this phase:

- no unrelated modified files were present in the working tree at commit time
- no root-level artifacts were created

## Commit result

Created on `deploy`:

1. `27c2b791` — `docs(mcp): retain step-04 production cutover report`
2. `17bc759f` — `fix(deploy): harden MCP release apply`

The second commit carried the bounded step-05 stabilization logic, operations-doc refresh, LF guardrail, and retained step-05 issue-history artifacts.

## Real deploy-path rerun result

Production rerun executed through the real deploy-branch GitHub Actions workflow:

- workflow: `Deploy Lifeline Production`
- run id: `22800013805`
- head sha: `17bc759fd2556026aa4c60ad7eb91b63edd3e82c`
- result: `success`

Observed job outcome:

- `Reserve MCP loopback port on VPS` — success
- `Apply release on VPS` — success
- `Sync MCP Nginx config on VPS` — success
- `Verify public MCP health on VPS` — success

This is the first successful production rerun after codifying the targeted post-app `lifeline-mcp` force-recreate path in `apply-release.sh`.

## Live validation after rerun

Validated after the successful run:

- active release: `/opt/lifeline/releases/lifeline-20260307133444-17bc759`
- `lifeline-app` healthy on `127.0.0.1:3020`
- `lifeline-mcp` healthy on `127.0.0.1:3030`
- `lifeline-postgres` healthy
- public app DB health: `https://lifeline.a2z-us.com/api/health/db`
- public app info: `https://lifeline.a2z-us.com/api/public/info`
- MCP loopback health: `http://127.0.0.1:3030/health`
- public MCP health: `https://mcp.lifeline.a2z-us.com/health`
- MCP internal adapter path from inside `lifeline-mcp`: `/internal/mcp/health`
- app bind remained `127.0.0.1:3020`
- MCP bind remained `127.0.0.1:3030`

## Public MCP validation after rerun

Used a short-lived production validation key for the dedicated smoke principal `mcp-smoke-user-1`.

Validated successfully:

- public tool discovery against `https://mcp.lifeline.a2z-us.com/mcp`
- read/write smoke flow using the official client utility

Observed outcome:

- MCP endpoint advertised 9 tools
- `create_task`, `list_today`, `search_tasks`, `complete_task`, and `delete_task` all succeeded end-to-end
- the created smoke task was archived successfully during cleanup

## Stabilization verdict

The original instability pattern did not recur during the validated rerun.

The strongest evidence is:

1. the real deploy-branch production workflow completed successfully
2. `Apply release on VPS` succeeded on the hardening commit that introduced staged startup and MCP-specific diagnostics
3. MCP loopback publication remained present on `127.0.0.1:3030` after deploy
4. public MCP health and bounded public MCP smoke both succeeded after the rerun

Conclusion: the step-05 bounded stabilization objective is satisfied.

## Main branch alignment result

After successful deploy validation, `main` was updated by fast-forwarding it to the validated `deploy` state and pushing the result.

Alignment method used:

- `git checkout main`
- `git merge --ff-only deploy`
- `git push origin main`

This preserved history hygiene and ensured `main` no longer lagged behind the validated production branch state.

## Documentation routing result

Retained artifacts for this phase live under:

- `docs/issues/mcp-server/step-05-cicd-stabilization/discovery/`
- `docs/issues/mcp-server/step-05-cicd-stabilization/planning/`
- `docs/issues/mcp-server/step-05-cicd-stabilization/implementation/`
- `docs/issues/mcp-server/step-05-cicd-stabilization/final/`

No root-level report was created.

## Final recommendation

Step-05 stabilization is fully closed.

Any future deploy failures should now be treated as new incidents unless they reproduce the same MCP loopback publication loss under the staged release helper path.
