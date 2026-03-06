# Onboarding, Profile, and Preferences

## Purpose

This document defines the product-level behavior for authenticated onboarding, ongoing profile management, and preference persistence.

## Canonical sources used for this document

- [client/src/pages/OnboardingPage.jsx](../../client/src/pages/OnboardingPage.jsx)
- [client/src/pages/ProfilePage.jsx](../../client/src/pages/ProfilePage.jsx)
- [client/src/components/ProfilePanel.jsx](../../client/src/components/ProfilePanel.jsx)
- [client/src/components/settings/Settings.jsx](../../client/src/components/settings/Settings.jsx)
- [client/src/components/settings/ExportImport.jsx](../../client/src/components/settings/ExportImport.jsx)
- [client/src/components/statistics/Statistics.jsx](../../client/src/components/statistics/Statistics.jsx)
- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [client/src/providers/ThemeProvider.jsx](../../client/src/providers/ThemeProvider.jsx)
- [backend/src/index.js](../../backend/src/index.js)

## Onboarding as a product gate

`onboarding` is the authenticated first-run profile completion flow.

The live product behavior is:

- once an authenticated identity is resolved, the app checks `currentUser.profile.onboarding_completed`
- if onboarding is incomplete, the app redirects the user to `/onboarding`
- the user cannot treat the authenticated app as fully ready until the required onboarding submission succeeds

This makes onboarding a gating workflow rather than an optional profile wizard.

## Required onboarding fields

The onboarding page requires:

- first name
- last name
- email

The flow also accepts optional fields:

- phone
- country
- timezone
- start day of week

## Start-day behavior

The onboarding experience includes a preferred start day of week.

Current product behavior:

- the field defaults to Monday
- some country entries cause the UI to suggest Sunday automatically
- the backend normalizes the value to a canonical day name such as `Sunday` or `Monday`
- the saved profile value later influences statistics and calendar-related behavior

## Email conflict behavior

The onboarding flow treats email conflicts as a first-class product concern.

If the backend determines the submitted email already belongs to another account:

- the submission returns a conflict response
- the page shows an explicit error state
- the user is prompted to use a different email rather than continuing silently

## Identity refresh after onboarding

After the onboarding submission succeeds, the frontend refreshes identity so `currentUser` reflects the saved profile and the authenticated app can resume normal use.

## Profile management after onboarding

Once onboarding is complete, the user can manage their profile in the profile area.

From the product perspective, profile management extends onboarding rather than replacing it with a different data model.

Canonical profile fields include:

- first name
- last name
- email
- phone
- country
- city
- timezone
- avatar URL
- start day of week
- onboarding completion state

## Preferences and personalization

### Theme and font preferences

The frontend persists theme and font locally for all users.

When the user is authenticated and identity is fully resolved, the theme provider also attempts to save theme and layout-related font preferences to `/api/settings`.

This means personalization has two layers:

- local browser persistence for immediate UX continuity
- authenticated server persistence when the account context is available

### Layout and week-start preferences

The statistics experience reads week-start preferences from:

- `profile.start_day_of_week`
- saved settings layout values

and uses them to shape week-based statistics ranges.

### Statistics as a preference-aware surface

Statistics is not just a passive report. It reacts to profile and settings data, especially around how the week is interpreted.

## Export, import, and reset as settings-adjacent workflows

The settings surface also contains account data-management workflows:

- export to JSON or CSV
- import via merge or replace mode
- delete all account data through reset-account

These are grouped with settings in the user experience because they are user-controlled account management actions.

## Guest-mode distinction

Guest users can still benefit from local theme and font persistence, but onboarding and profile persistence are authenticated-only product behavior.

Canonical product docs should therefore avoid implying that guest mode has a true server-backed profile.

## Product rules to preserve in downstream docs

- onboarding is mandatory before normal authenticated use
- first name, last name, and email are required in onboarding
- start day of week is both a profile field and a behavior-shaping preference
- personalization can exist locally for all users, but authenticated users also get backend persistence
- export, import, and reset-account are authenticated account-management actions

## Related canonical documents

- [identity-and-access-modes.md](identity-and-access-modes.md)
- [core-product-concepts.md](core-product-concepts.md)
- [../frontend/profile-and-onboarding-screens.md](../frontend/profile-and-onboarding-screens.md)
- [../frontend/settings-statistics-and-data-management.md](../frontend/settings-statistics-and-data-management.md)
- [../api/auth-profile-and-settings-endpoints.md](../api/auth-profile-and-settings-endpoints.md)
