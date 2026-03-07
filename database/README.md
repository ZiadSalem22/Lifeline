# Database Local Assets

This directory is reserved for intentional repo-level database assets only.

It is not a general dump location for ad hoc local outputs.

## Structure

- `phase3/`
  - `README.md` — retention and governance notes for the preserved Phase 3 database assets
  - `runs/` — retained Phase 3 rehearsal evidence and the guarded location for any future explicitly preserved runs

## Governance rules

- Keep only database-related support material or intentionally retained evidence here.
- Do not place random temporary exports, scratch files, or one-off local experiments in this directory.
- New generated run folders should remain ignored by default unless they are intentionally promoted for retention.
- Application source code belongs under `backend/` and `client/`, not here.

## Notes

- This directory is intentionally separate from legacy files under `db/` and from backend runtime code.
- The successful end-to-end Phase 3 rehearsal evidence is intentionally preserved here as historical validation material.
