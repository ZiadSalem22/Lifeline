# Tag Endpoints

## Purpose

This document describes the current tag endpoint group, including the default-tag baseline, authenticated custom-tag behavior, and current contract caveats.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/application/TagUseCases.js](../../backend/src/application/TagUseCases.js)
- [backend/src/infrastructure/TypeORMTagRepository.js](../../backend/src/infrastructure/TypeORMTagRepository.js)
- [backend/src/middleware/roles.js](../../backend/src/middleware/roles.js)

## Endpoint summary

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/tags` | `GET` | Return tags for the current user or default tags in fallback branch logic |
| `/api/tags` | `POST` | Create a custom tag |
| `/api/tags/:id` | `PATCH` | Update a custom tag |
| `/api/tags/:id` | `DELETE` | Delete a custom tag |

## `GET /api/tags`

### Handler intent

The route handler is written to:

- return personalized default-plus-custom tags when `req.currentUser.id` exists
- otherwise return only default tags

### Current contract caveat

Because the `/api` prefix is still behind the global `checkJwt` + `attachCurrentUser` middleware chain, anonymous success should not be treated as the stable current production contract without verifying the auth runtime behavior.

Canonical API consumers should therefore assume authenticated use unless the runtime is explicitly configured in a more permissive development mode.

### Authenticated response shape

For authenticated callers, the response is an array of tag objects representing:

- default tags
- the current user's custom tags

## `POST /api/tags`

### Purpose

Creates a custom tag for the authenticated user.

### Current request fields

- `name`
- `color`

### Current behavior

- requires authentication
- free-tier users are limited to 50 custom tags
- route-level logic blocks over-limit requests with `403`
- default-tag spoofing is not allowed; creation is forced into custom-tag semantics

### Success response

Returns the created tag object with `201`.

## `PATCH /api/tags/:id`

### Purpose

Updates a custom tag.

### Current protection rules

- the tag must exist
- default tags cannot be modified
- the tag must belong to the current user

### Current error behavior

- missing tag -> `404`
- default tag or non-owner -> `403`
- unexpected failure -> `500`

## `DELETE /api/tags/:id`

### Purpose

Deletes a custom tag.

### Current protection rules

- default tags cannot be deleted
- the tag must belong to the current user

### Current success behavior

Returns `204` on success.

## Related canonical documents

- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [todo-endpoints.md](todo-endpoints.md)
- [../backend/tag-search-stats-and-data-transfer-services.md](../backend/tag-search-stats-and-data-transfer-services.md)
- [../product/core-product-concepts.md](../product/core-product-concepts.md)
