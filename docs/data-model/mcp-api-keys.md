# MCP API Keys

## Purpose

This document describes the current persisted data model for Lifeline MCP API keys.

## Canonical sources used for this document

- [backend/src/infra/db/entities/McpApiKeyEntity.js](../../backend/src/infra/db/entities/McpApiKeyEntity.js)
- [backend/src/migrations/1772862400000-add-mcp-api-keys.js](../../backend/src/migrations/1772862400000-add-mcp-api-keys.js)
- [backend/src/infrastructure/TypeORMMcpApiKeyRepository.js](../../backend/src/infrastructure/TypeORMMcpApiKeyRepository.js)
- [backend/src/application/IssueMcpApiKey.js](../../backend/src/application/IssueMcpApiKey.js)
- [backend/src/application/ResolveMcpApiKeyPrincipal.js](../../backend/src/application/ResolveMcpApiKeyPrincipal.js)

## Table role

`mcp_api_keys` is the persisted key-lifecycle table for MCP client authentication.

Each row belongs to one Lifeline user and represents one independently revocable key.

## Ownership and relationship

Current relationship:

- foreign key: `user_id -> users.id`
- cardinality: many keys to one user
- delete behavior: cascade when the owning user is deleted

This means MCP keys are fully user-owned artifacts rather than global shared secrets.

## Current columns that matter most

| Column | Meaning |
| --- | --- |
| `id` | Primary key for the persisted key record. |
| `user_id` | Owning Lifeline user id. |
| `name` | User-facing label for the key. |
| `key_prefix` | Public-safe prefix used to look up the record before verifying the secret. |
| `key_hash` | Hashed secret material. Plaintext is not stored. |
| `scopes` | JSONB array of allowed MCP scopes. |
| `status` | Current persisted lifecycle state such as `active`, `revoked`, or `expired`. |
| `expires_at` | Optional expiry timestamp. |
| `last_used_at` | Most recent successful auth usage timestamp. |
| `last_used_ip` | Last observed client IP from successful key resolution. |
| `last_used_user_agent` | Last observed client user-agent from successful key resolution. |
| `revoked_at` | Timestamp of explicit revocation. |
| `revocation_reason` | Optional stored revocation reason. |
| `created_at` / `updated_at` | Audit-style timestamps. |

## Secret-storage rule

The current model deliberately splits key material into two pieces:

- `key_prefix` is stored so the record can be located efficiently
- `key_hash` stores a peppered hash of the secret portion only

The full plaintext key is assembled and returned once at issuance time as:

- `<key_prefix>.<secret>`

The secret portion is never persisted in plaintext.

## Status and lifecycle semantics

### Active

An active key can authenticate through the MCP resolution path.

### Expired

A key is treated as expired when either:

- the persisted `status` is `expired`, or
- `expires_at` is in the past at resolution time

### Revoked

A revoked key is blocked when either:

- `status` is `revoked`, or
- `revoked_at` is present

This means revocation has an explicit persisted marker instead of relying only on deletion.

## Constraints and indexes

Current migration safety rules include:

- non-blank checks for `id`, `name`, `key_prefix`, and `key_hash`
- JSON-array check for `scopes`
- status check constrained to `active`, `revoked`, or `expired`
- unique index on `key_prefix`
- index on `(user_id, status)`
- partial indexes for `expires_at` and `last_used_at`

## Runtime persistence behavior

### Issuance

`IssueMcpApiKey` writes:

- user ownership
- label/name
- unique prefix
- hashed secret
- scopes
- active status
- optional expiry

### Successful auth resolution

`ResolveMcpApiKeyPrincipal` records usage metadata best-effort:

- `last_used_at`
- `last_used_ip`
- `last_used_user_agent`

### Revocation

The product self-serve path updates:

- `status`
- `revoked_at`
- `revocation_reason`

## Related canonical documents

- [overview-and-current-source-of-truth.md](overview-and-current-source-of-truth.md)
- [users-profiles-and-settings.md](users-profiles-and-settings.md)
- [../backend/mcp-api-key-management.md](../backend/mcp-api-key-management.md)
- [../api/auth-profile-and-settings-endpoints.md](../api/auth-profile-and-settings-endpoints.md)
