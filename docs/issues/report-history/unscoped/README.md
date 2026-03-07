# Unscoped Report Fallback

This folder is the secondary fallback when a prompt requests a report or execution artifact but does not provide a valid non-root issue-history path and the initiative/step cannot be derived confidently.

Preferred routing is still:

- `docs/issues/<initiative>/<step>/discovery/`
- `docs/issues/<initiative>/<step>/planning/`
- `docs/issues/<initiative>/<step>/implementation/`
- `docs/issues/<initiative>/<step>/final/`

Use this folder only when that scoped routing cannot be determined.
