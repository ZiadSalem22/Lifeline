# Lifeline UI Wireframe & Layout Structure

This documents the target layout behavior for Desktop and Mobile, focusing on TopBar, Sidebar, and the Main Content (center panel).

## Desktop (≥ 1024px)

[TopBar: fixed]
| [Menu] [Title] | [   Search Pill (max 600px)   ] | [ Identity (avatar + FirstName ▾) ] |

- Container: `.top-bar-main` uses flex; no wrapping.
- Left group: Menu button (optional) + Title (truncated, max ~220px).
- Center: `.top-bar-search` flex: 1 1 480px; min 240px; max 600px; margin: 0 12px.
- Right: `.identity-chip` max 240px; `.chip-name` truncated.
- Search never overlaps identity or title; stays centered by available space.

[Body]
| [Sidebar (fixed, left, below top bar)] | [Main Content (scrolls under the top bar)] |

- `.sidebar` is fixed at `top: 69px`, `height: calc(100vh - 69px)`.
- `.main-content` has `margin-left: var(--sidebar-width)` and `padding-top` to account for the fixed top bar.

## Tablet (900px – 1023px)

- Hamburger menu visible.
- Search pill shrinks but remains centered: same flex rules (min 240px, max 600px).
- Identity truncates earlier (`.identity-chip` max ~200px, `.chip-name` ~90px).

## Mobile (≤ 720px)

[TopBar: row]
| [Menu] [Title centered] [Identity]

[Search]
| [ Search Pill (full width) ]

- Search expands to full width: `.top-bar-search` flex: 1 1 100%; width: 100%; max-width: none.
- Title is absolutely centered relative to `.top-bar-main` (pointer-events: none) to avoid overlap.
- Identity remains on the right, truncated (`.chip-name` ~72px).

[Sidebar Drawer]
- `.sidebar` slides from left, `top: 0`, `height: 100vh`, `z-index: 10001`.
- `.sidebar-overlay` under it with `z-index: 10000`.
- While open: `html.has-open-sidebar, body` are `overflow: hidden; height: 100%` to prevent background scroll.
- `.has-open-sidebar .top-bar` and `.main-content` translateX by the drawer width for iOS-like affordance.

## Interactions

- Identity Chip: Entire block toggles dropdown. Dropdown items: Profile, Settings, Logout.
- Settings icon is removed from the top bar; use dropdown entry instead.
- Outside click closes dropdown via document listener.

## Notes

- Use truncation for Title and Identity Name to avoid layout shifts.
- Keep `.top-bar-search` spacing with `margin: 0 12px` so it doesn’t collide.
- Maintain z-index layering: TopBar (60), Mobile Sidebar (10001), Overlay (10000), Dropdowns (200).
