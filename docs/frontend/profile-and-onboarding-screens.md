# Profile and Onboarding Screens

## Purpose

This document defines the current frontend behavior for the onboarding and profile surfaces.

## Canonical sources used for this document

- [client/src/pages/OnboardingPage.jsx](../../client/src/pages/OnboardingPage.jsx)
- [client/src/pages/ProfilePage.jsx](../../client/src/pages/ProfilePage.jsx)
- [client/src/components/ProfilePanel.jsx](../../client/src/components/ProfilePanel.jsx)
- [client/src/components/auth/ProtectedRoute.jsx](../../client/src/components/auth/ProtectedRoute.jsx)
- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)

## Onboarding screen

### Route and access

The onboarding screen is exposed at `/onboarding` and wrapped in `ProtectedRoute`.

That means:

- unauthenticated users are redirected to `/auth`
- guest-mode users are redirected away from onboarding
- already-complete onboarded users are redirected back to `/`

### Screen role

The onboarding screen is a dedicated full-page form rather than a small modal.

It is intentionally positioned as a first-run checkpoint before normal authenticated use continues.

### Fields shown

The onboarding page currently collects:

- first name
- last name
- email
- phone
- country
- start day of week

### UX behavior

Current frontend behavior includes:

- loading no content until identity has been checked when not in guest mode
- required validation for first name, last name, and email
- country-sensitive convenience defaults for start day of week in some cases
- inline conflict handling when the submitted email is already in use
- identity refresh after a successful submit so the app can resume normal authenticated flow

## Profile screen

### Route and access

The profile screen is exposed at `/profile` and protected by `ProtectedRoute`.

### Layout model

`ProfilePage` uses the shared app shell and renders `ProfilePanel` inside the main content area.

### Profile panel behavior

The profile panel:

- loads the current authenticated profile from the backend
- shows a card-style editing form
- requires first and last name for save
- supports editing optional fields such as email, phone, country, city, and avatar URL
- shows avatar preview when an avatar URL is present
- shows toast-style success feedback after save

### Important current limitation

Week-start editing is intentionally not exposed on the profile page UI even though week-start preferences exist elsewhere in the product.

The component explicitly leaves that preference to other surfaces such as statistics/settings-related flows.

## Relationship between onboarding and profile

The two screens are related but not identical.

Current frontend model:

- onboarding is the required first authenticated completion step
- profile is the later ongoing editing surface
- both rely on the same backend profile endpoint and current-user refresh behavior

## Redirect behavior worth preserving

- onboarding redirect is triggered by `currentUser.profile.onboarding_completed === false`
- `OnboardingPage` itself also protects against being shown to guest users or already-complete users
- `ProfilePage` depends on auth protection rather than guest-mode compatibility

## Related canonical documents

- [routes-and-pages.md](routes-and-pages.md)
- [settings-statistics-and-data-management.md](settings-statistics-and-data-management.md)
- [../product/identity-and-access-modes.md](../product/identity-and-access-modes.md)
- [../product/onboarding-profile-and-preferences.md](../product/onboarding-profile-and-preferences.md)
