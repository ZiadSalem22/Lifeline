# Live Data Restore Diagnosis Report

## 1. Executive Summary

The live VPS app was connected to the correct PostgreSQL database, but the real migrated dataset had not been restored into that live VPS database.

That was the primary cause of the "fresh account + onboarding" behavior.

What was found:
- the live VPS PostgreSQL database initially contained only one newly created user record
- that record matched the currently logged-in Auth0 identity
- the live VPS database initially contained no restored todos, no restored personal tags, and no restored settings data
- the validated Phase 3 transformed snapshot with the full migrated dataset was present in the repo and contained the expected historical data

What was fixed:
- the real transformed snapshot dataset was restored into the live VPS PostgreSQL database
- the live database now contains the full migrated counts:
  - users: 7
  - user_profiles: 7
  - user_settings: 7
  - todos: 536
  - tags: 17
  - todo_tags: 564

Important secondary finding:
- the currently logged-in Auth0 identity is present in the restored dataset and now has an onboarding-complete profile
- however, the large historical todo dataset belongs to a different Auth0 identity
- so the root cause was missing restore, but there is also a real identity mismatch if the expectation was to see the 509-task historical account immediately after login

## 2. Current Live DB Findings

### Before the fix
Direct inspection of the live VPS PostgreSQL database showed:
- database: `lifeline`
- role: `lifeline`
- users: 1
- user_profiles: 1
- user_settings: 0
- todos: 0
- tags: 0
- todo_tags: 0

The single live user row present before the fix was:
- `google-oauth2|118044604482335524187`

The single live profile row present before the fix was newly created from the live onboarding flow.

This proves:
- the app was wired to the expected live PostgreSQL database
- the database was not populated with the migrated dataset
- the "new user" behavior was happening against the live VPS database itself, not against some separate hidden database

### Data source available for restore
The repo already contained the validated Phase 3 migration artifacts under:
- [database/phase3/runs/2026-03-06T11-29-47-387Z/transformed-snapshot.json](database/phase3/runs/2026-03-06T11-29-47-387Z/transformed-snapshot.json)
- [database/phase3/runs/2026-03-06T11-29-47-387Z/import-report.json](database/phase3/runs/2026-03-06T11-29-47-387Z/import-report.json)
- [database/phase3/runs/2026-03-06T11-29-47-387Z/validation-report.json](database/phase3/runs/2026-03-06T11-29-47-387Z/validation-report.json)

Those artifacts showed the intended migrated counts:
- users: 7
- user_profiles: 7
- user_settings: 7
- todos: 536
- tags: 17
- todo_tags: 564

## 3. Logged-In Auth0 Identity Findings

The currently logged-in live Auth0 identity was inferred from the live VPS database row created during the production login flow:
- `google-oauth2|118044604482335524187`

That identity is present in the migrated dataset.

After restore, that user exists in the live VPS database with:
- user id: `google-oauth2|118044604482335524187`
- email: `ziyad.salem101@gmail.com`
- profile exists: yes
- onboarding completed: yes
- start day of week: `Monday`
- settings exists: yes
- todos for this identity: 0
- personal tags for this identity: 0

Critical comparison:
- the main historical data-rich account in the migrated dataset is:
  - `google-oauth2|115755817281204775359`
- that identity has:
  - onboarding completed: yes
  - user settings: yes
  - todos: 509
  - personal tags: 7

Therefore:
- the current live identity does exist in the restored dataset
- the current live identity should no longer be treated as a new onboarding user after the restore
- but the largest historical todo dataset belongs to a different Auth0 identity

## 4. Restore Status Assessment

Assessment of the required possibilities:

### 1. No restore happened
True.

Evidence:
- before the fix, the live VPS database had only 1 user and 0 todos
- the validated migrated dataset should have had 7 users and 536 todos
- the app-created fresh user row landed directly in the live VPS database

### 2. Restore happened but wrong DB is connected
False.

Evidence:
- the live app was connected to the `lifeline` database in the live VPS Postgres container
- the fresh login-created row appeared in that same database
- there was no evidence that the app was reading from a different Postgres database

### 3. Restore happened but wrong user identity is being matched
Not the primary cause of the onboarding problem.

The onboarding problem came from the missing restore.

However, there is a secondary identity mismatch relative to the large historical task dataset:
- current live identity: `google-oauth2|118044604482335524187`
- historical data-rich identity: `google-oauth2|115755817281204775359`

So the exact diagnosis is:
- primary issue: missing restore
- secondary issue: the currently logged-in identity is not the historical account that owns the 509-task dataset

## 5. Fix Applied

The following fix was applied safely.

### Safety step
A backup of the pre-restore live VPS database was created at:
- `/opt/lifeline/shared/backups/live-pre-restore-20260306.sql`

### Restore step
The validated transformed snapshot from:
- [database/phase3/runs/2026-03-06T11-29-47-387Z/transformed-snapshot.json](database/phase3/runs/2026-03-06T11-29-47-387Z/transformed-snapshot.json)

was converted into PostgreSQL restore SQL and applied to the live VPS PostgreSQL database.

Restore behavior:
- truncated live application tables
- restored `users`
- restored `user_profiles`
- restored `user_settings`
- restored `tags`
- restored `todos`
- restored `todo_tags`

No identity remapping or risky account merge was performed.

## 6. Post-Fix Verification

### Live VPS database counts after restore
Verified directly in the live VPS PostgreSQL database:
- users: 7
- user_profiles: 7
- user_settings: 7
- todos: 536
- tags: 17
- todo_tags: 564

### Current live identity after restore
Verified directly in the live VPS PostgreSQL database:
- current live identity row exists: yes
- current live profile exists: yes
- current live profile onboarding completed: yes
- current live settings row exists: yes

This means the current live identity should no longer route through onboarding as a brand-new user once the app reads the restored profile state.

### Historical data-rich account after restore
Verified directly in the live VPS PostgreSQL database:
- `google-oauth2|115755817281204775359` exists
- profile exists and onboarding completed is true
- todo count: 509
- personal tag count: 7

### Live app/runtime state after restore
The live app remained deployed against the same VPS stack and database service.

The fix changed data contents, not the production routing shape.

### Verification limitation
A fresh authenticated browser session was not replayed in automation with live credentials after the restore.

So the post-fix verification is DB-level and identity-level, not a full new credentialed UI replay.

But the DB state now proves:
- the current live identity is no longer a missing-profile user
- the restore is now present in the live VPS database
- the large historical dataset belongs to a different Auth0 identity

## 7. Remaining Risks

- if the user expects to see the 509-task historical dataset while logged in as `google-oauth2|118044604482335524187`, that expectation will still not be met because those tasks belong to `google-oauth2|115755817281204775359`
- merging or remapping Auth0 identities would be risky and was intentionally not done automatically
- a manual post-restore browser refresh/login check is still recommended to confirm the current live account now bypasses onboarding

## 8. Completion Status

Completed:
- live VPS Postgres inspected directly
- live data presence checked directly
- current logged-in Auth0 identity inferred and compared against restored records
- root cause determined
- real data restore applied to the live VPS PostgreSQL database
- post-restore DB verification completed

Final diagnosis:
- primary issue: missing restore
- secondary finding: identity mismatch exists relative to the data-rich historical account

Recommended immediate user check:
- refresh the live app while logged in as the current account and confirm onboarding no longer appears
- if the expectation is specifically the 509-task historical dataset, sign in with the Auth0 identity that owns that dataset or decide explicitly whether an account merge/remap should be done