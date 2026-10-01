# Changelog

All notable changes to RootRay, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
style. Dates are UTC. Authoritative detail: [STATUS.md](STATUS.md).

## [Unreleased] — v0.3.0 (development)

### Added — Integrated Browser Workbench

- Embedded WebView2 **Preview** inside RootRay — the project runs in the
  app, not an external browser. Interact/Inspect modes, browser toolbar
  (back/forward/reload/URL/external), loopback-only main-frame navigation;
  remote new-window links open in the system browser. Preview webview has
  zero IPC privileges.
- **Click-to-source in one window** — inspect an element and the mapped
  source opens beside the Preview; edit and save with HMR/Fast Refresh
  or SSE reload applying in place.
- **Flexible workbench layout** — collapsible/resizable Explorer,
  Inspector and Output panes (`Ctrl+B`, `Ctrl+J`), Preview/Code/Split
  views, Preview Focus and Code Focus modes, draggable split with
  double-click reset, persisted layout with clamping, Reset Layout.
- **Responsive workbench** — Inspector auto-collapses before Explorer
  when Split cannot satisfy Preview + Code minimums; user preferences
  are preserved and restored when space returns.
- **Brand identity** — official RootRay application icon across the
  executable, installer, uninstaller, Start Menu, taskbar and Alt+Tab;
  pixel-art mascot/wordmark on home/splash, canonical guide in
  `docs/brand.md`.
- `change_project` command — switching projects while a server runs
  stops the old tree and analyzes under one lifecycle hold.
- `RuntimeState.seq` — monotonic snapshot ordering; the reducer drops
  stale `rootray://state` arrivals.

### Fixed

- `illegal runtime state transition: running -> analyzing` when changing
  projects mid-run — lifecycle commands are now serialized.
- Stale workspace display after project change — out-of-order state
  events could overwrite the newer snapshot.
- Preview bounds/visibility now track every layout change (pane
  collapse, split drag, focus modes, output resize).
- Quick Edit could transiently present a blank CodeMirror surface on
  slow mounts — the editor now reconciles content after the lazy view
  mounts and stays hidden until real source text is rendered.
- **Installed build rendered an empty CodeMirror surface** — Tauri
  injects per-asset `'nonce-…'` sources into `style-src`, which makes
  the configured `'unsafe-inline'` inert and blocked CodeMirror's
  runtime `style-mod` stylesheet (gutters painted, code text stacked
  below the fold). CSP modification is now disabled for `style-src`
  only; `script-src` keeps its nonce hardening.
- Toggling a pane that the responsive policy had auto-hidden silently
  discarded the saved visibility preference; the toggle now explains
  that the pane is hidden for width and returns when there is room.
- Dev-server startup failures (missing dependencies, spawn errors)
  reach a visible failed state with useful output and a working Retry —
  no blank window, no stuck Preview, no orphaned process tree.

### Community

- CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG.md,
  GitHub issue forms and PR template.

## [0.2.0] — 2026-09 — Universal Project Workspace

- Evidence-based workspace analysis (kind, package manager, targets,
  capability matrix) replacing the global "supported" gate.
- Framework detection: Vue+Vite, Svelte+Vite, SvelteKit, Astro, Nuxt,
  Angular, Remotion — with honest capability tiers.
- Generic-DOM inspection for non-React targets; authored-HTML source
  mapping via parser-based stamping.
- Native loopback static server for `index.html` projects with
  save-driven SSE reload.
- Next.js adapter (Turbopack + webpack dev paths), React 19 support,
  instrumentation idempotency.
- Installer, session recovery, diagnostics, accessibility pass.
- See the [v0.2.0 release](https://github.com/abudoxali/RootRay/releases/tag/v0.2.0)
  and STATUS.md for the full record.

## [0.1.1] — 2026-09 — Patch

- Fixed: project picker closed without analyzing (missing
  `rootray://state` emission after `analyze_project`).

## [0.1.0] — 2026-09 — MVP

- Initial release: React+Vite inspection, click-to-source, component and
  style intelligence, Quick Edit with safe saves, Explorer, Quick Open,
  Workspace Search, Windows Job Object containment, NSIS installer.
