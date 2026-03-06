# Issue: Fix side menu (drawer) to open from top and cover full viewport

Priority: High

Description

The mobile side menu (drawer) currently opens below the header and does not start at the top of the viewport. It is nested in a page container and therefore does not dim or push the header and full viewport content when opened.

Goal

Make the drawer behave like an iOS full-height drawer:

- Drawer must always start at `top: 0` and cover the screen from the very top down.
- The overlay/backdrop must cover the entire viewport and dim it (including the header).
- Drawer must not be nested inside the main page container — it must be mounted at the document root to avoid inherited margins/padding.
- Drawer element must use fixed positioning and a high z-index so it's above the header.
- The slide-in animation should originate from the far left of the viewport (top-left), not below the header.

Acceptance criteria

- Tapping the menu icon slides the drawer in from the left starting at the top of the screen.
- The overlay dims the full viewport (header included).
- The drawer is positioned with `position: fixed; top: 0; left: 0; height: 100vh;` and `z-index` higher than the header.
- The drawer is mounted outside content containers (mount point: `document.body`).
- Optional: When open, the main content and header shift right by the width of the drawer (mobile only), implemented with a root-level class so the effect can be toggled.

Reproduction steps

1. On a mobile viewport, open the app.
2. Tap the menu (hamburger) icon.
3. Observe: the drawer previously started below the header; expected behavior is start at the top and dim/push the header and full viewport.

Files changed

- `client/src/components/layout/Sidebar.jsx` — render overlay + drawer via portal and toggle root class when open.
- `client/src/styles/base.css` — ensure the `.sidebar` styles set `top:0`/`height:100vh`, overlay covers the viewport, and z-index values keep the drawer above the header.

Notes

- Do not modify backend or Azure resources.
- Verified changes locally in the codebase; next step is to run `npm run dev` in `client` and test on mobile viewport.
