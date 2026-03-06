# Settings, Statistics, and Data Management

## Purpose

This document describes the current frontend surfaces for settings, statistics, export/import, and destructive account-level data management.

## Canonical sources used for this document

- [client/src/components/settings/Settings.jsx](../../client/src/components/settings/Settings.jsx)
- [client/src/components/settings/ExportImport.jsx](../../client/src/components/settings/ExportImport.jsx)
- [client/src/components/statistics/Statistics.jsx](../../client/src/components/statistics/Statistics.jsx)
- [client/src/pages/StatisticsPage.jsx](../../client/src/pages/StatisticsPage.jsx)
- [client/src/providers/ThemeProvider.jsx](../../client/src/providers/ThemeProvider.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)

## Settings surface

### Delivery model

The current settings experience is primarily overlay-based, not route-based.

Users open settings from:

- the authenticated identity dropdown
- the sidebar settings button

### Current settings tabs

The settings modal currently exposes these tabs:

- `Tags`
- `Appearance`
- `About`
- `Import / Export`

### Tag management behavior

The settings UI supports:

- creating tags
- editing tags
- deleting tags
- browsing current tags in a scrollable list

This makes settings the primary frontend maintenance surface for custom tags.

### Appearance behavior

Appearance choices are tied to the theme and font systems managed by the frontend providers.

The frontend keeps these preferences locally and can also persist them for authenticated users.

## Statistics surface

### Routes

Statistics is exposed through:

- `/statistics`
- `/stats`

### Layout model

The statistics page uses the shared app shell and renders the statistics card content inside the main container.

### Current capabilities

The statistics screen currently supports:

- overall metrics
- period toggles for all, day, week, month, and year
- period-specific range inputs
- week-start-sensitive weekly calculations
- top-tag summaries
- line and donut style visualizations
- guest-mode local fallback statistics when authenticated stats are not available

### Week-start preference interaction

Statistics is also one of the product surfaces that reflects week-start preference behavior.

It can:

- load week-start preference from profile or settings
- use that preference to calculate weekly boundaries
- persist a changed week-start preference through settings save behavior

## Export and import UI

The export/import experience is grouped with settings and data management.

Current UI behaviors include:

- exporting as JSON or CSV
- choosing import mode as merge or replace
- selecting files for import
- showing success or error messages inline
- triggering parent reload behavior after successful import

## Delete-all-data behavior

The export/import modal also exposes a destructive account-management action to delete all account data.

Current frontend behavior:

- prompts for confirmation
- calls the reset-account API
- shows progress feedback
- reloads after success

This is a high-impact action and should stay clearly documented as part of the account data-management UI.

## Guest versus authenticated differences

### Guest mode

- local theme and font behavior still works
- statistics can compute from guest data
- authenticated export/import/reset-account flows are not the primary source of truth

### Authenticated mode

- settings persistence is available through the backend
- export/import becomes account-scoped
- reset-account operates on server-backed records

## Frontend writing rules worth preserving

- settings is currently an overlay surface, not a routed page in the active route map
- statistics is a full routed surface with route aliases
- export/import and reset-account are settings-adjacent management flows, not separate frontend applications
- week-start preference belongs to the lived statistics/settings behavior, not only to backend or data-model docs

## Related canonical documents

- [routes-and-pages.md](routes-and-pages.md)
- [layout-navigation-and-responsive-behavior.md](layout-navigation-and-responsive-behavior.md)
- [profile-and-onboarding-screens.md](profile-and-onboarding-screens.md)
- [../product/onboarding-profile-and-preferences.md](../product/onboarding-profile-and-preferences.md)
