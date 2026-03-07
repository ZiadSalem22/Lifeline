# Users, Profiles, and Settings

## Purpose

This document describes the current persisted identity-adjacent tables and the runtime relationships between `users`, `user_profiles`, and `user_settings`.

## Canonical sources used for this document

- [backend/src/infra/db/entities/UserEntity.js](../../backend/src/infra/db/entities/UserEntity.js)
- [backend/src/infra/db/entities/UserProfileEntity.js](../../backend/src/infra/db/entities/UserProfileEntity.js)
- [backend/src/infra/db/entities/UserSettingsEntity.js](../../backend/src/infra/db/entities/UserSettingsEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infrastructure/TypeORMUserRepository.js](../../backend/src/infrastructure/TypeORMUserRepository.js)
- [backend/src/infrastructure/TypeORMUserProfileRepository.js](../../backend/src/infrastructure/TypeORMUserProfileRepository.js)
- [backend/src/infrastructure/TypeORMUserSettingsRepository.js](../../backend/src/infrastructure/TypeORMUserSettingsRepository.js)
- [backend/src/middleware/attachCurrentUser.js](../../backend/src/middleware/attachCurrentUser.js)
- [backend/src/index.js](../../backend/src/index.js)

## `users` table

### Role

`users` is the base authenticated identity table.

It stores the local persisted record that corresponds to the Auth0 subject used by the API.

### Columns that matter most

| Column | Meaning |
| --- | --- |
| `id` | Primary key. In practice this is the Auth0 subject string used as the local user id. |
| `auth0_sub` | Persisted Auth0 subject, also unique. |
| `email` | Nullable email, normalized to lowercase when written through the repository layer. |
| `name` | Display name snapshot from identity claims. |
| `picture` | Profile-picture URL snapshot from identity claims. |
| `role` | Current coarse app role such as `free`, `paid`, or `admin`. |
| `subscription_status` | Current coarse billing/subscription state, defaulting to `none`. |
| `created_at` / `updated_at` | Audit-style timestamps managed by the database and TypeORM metadata. |

### Identity mapping rule

The current repository logic treats the Auth0 subject as both:

- the user primary key `users.id`
- the unique identity field `users.auth0_sub`

That means Lifeline does not currently maintain a separate surrogate numeric user id.

### Current constraints and indexes

The current migration enforces:

- non-blank `id`
- non-blank `auth0_sub`
- non-blank email when email is present
- unique `auth0_sub`
- unique lowercased non-null email
- indexes on `role` and `subscription_status`

## `user_profiles` table

### Role

`user_profiles` stores the product-facing onboarding and profile fields that are not part of the base Auth0 identity snapshot.

### Current relationship to `users`

- primary key: `user_id`
- foreign key: `user_id -> users.id`
- cardinality: one-to-one
- delete behavior: cascade when the owning user is deleted

The live Postgres schema therefore uses `user_id` as both the primary key and the foreign key. The current model does not use a separate profile id.

### Fields with product significance

| Column | Meaning |
| --- | --- |
| `first_name` / `last_name` | Profile name fields used by onboarding/profile editing. |
| `phone`, `country`, `city`, `timezone` | Additional profile metadata. |
| `avatar_url` | User-selected profile avatar URL. |
| `onboarding_completed` | Canonical onboarding gate flag. |
| `start_day_of_week` | Persisted preferred week-start day for day-oriented flows. |
| `created_at` / `updated_at` | Timestamps. |

### Validation and default behavior

The current schema gives `start_day_of_week` a default of `Monday` and restricts it to the seven weekday names.

The API layer also normalizes incoming `start_day_of_week` values before writing them.

## `user_settings` table

### Role

`user_settings` stores lightweight UI-preference state that is conceptually separate from the profile.

### Current relationship to `users`

- primary key: `user_id`
- foreign key: `user_id -> users.id`
- cardinality: one-to-one
- delete behavior: cascade when the owning user is deleted

### Fields with runtime significance

| Column | Meaning |
| --- | --- |
| `theme` | Theme preference, default `system`. |
| `locale` | Locale preference, default `en`. |
| `layout` | JSON object for persisted layout-oriented UI settings. |
| `created_at` / `updated_at` | Timestamps. |

### JSON constraint

The active Postgres schema enforces that `layout` must be a JSON object, not an array or primitive.

## How these tables are loaded at runtime

`attachCurrentUser` resolves the authenticated user and then loads:

- the user row
- the profile row, if present
- the settings row, if present

The middleware attaches all of that material to `req.currentUser` so downstream routes can use a combined identity/profile/settings view.

## Creation and upsert behavior

### Users

`TypeORMUserRepository` creates or updates the user row from Auth0 claims during authenticated request handling.

### Profiles

`TypeORMUserProfileRepository.saveOrUpdate()` creates the row lazily when needed and defaults:

- `onboarding_completed` to `false`
- `start_day_of_week` to `Monday`

### Settings

`TypeORMUserSettingsRepository.saveOrUpdate()` also creates the row lazily and normalizes:

- empty theme to `system`
- empty locale to `en`
- invalid or non-object layout input to `{}`

## Practical persistence split: profile vs settings

The current split is:

- `user_profiles` for onboarding and personal profile information
- `user_settings` for UI preference state

This separation matters because onboarding completion and start-day behavior belong to product behavior, while theme/locale/layout are presentation preferences.

## Related canonical documents

- [overview-and-current-source-of-truth.md](overview-and-current-source-of-truth.md)
- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [../product/identity-and-access-modes.md](../product/identity-and-access-modes.md)
- [../product/onboarding-profile-and-preferences.md](../product/onboarding-profile-and-preferences.md)
- [../backend/auth-user-attachment-and-rbac.md](../backend/auth-user-attachment-and-rbac.md)
