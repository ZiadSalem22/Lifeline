# Phase 3 Database Assets

This directory holds the intentional Phase 3 database artifacts that were kept after the PostgreSQL migration and rehearsal work.

## Structure

- `runs/`
  - contains the single retained successful MSSQL-to-PostgreSQL rehearsal evidence run

## Retention policy

- Keep the successful evidence run for historical validation and reproducibility context.
- Treat any newly generated run folders as disposable local artifacts unless they are explicitly reviewed and promoted.
- If a future run is worth keeping, preserve it intentionally and update the ignore rules rather than allowing silent accumulation.
- Phase 3 tooling still writes new rehearsal outputs under `database/phase3/runs/`, so this directory should stay tightly governed.
