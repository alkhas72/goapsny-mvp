# Composer 2 — mobile and accessibility harness

You are the sole writer for `feat/epoch3-mobile-a11y-composer`.

Read `.ui-craft/brief.md`, `.ui-craft/tokens.md`, `DESIGN.md`, and existing browser tests. Do not redesign or change application behavior. Own only browser/a11y test harnesses, fixtures and evidence tooling.

Build repeatable checks for widths 360, 390, 768, 1024 and 1440 covering:

- public map opens without registration wall or automatic location prompt;
- controls and toggles have ≥44×44 px targets and visible keyboard focus;
- status is expressed by text plus color;
- bottom sheet, return path and bottom navigation remain usable;
- email OTP accepts 8 digits;
- explicit geolocation activation/deactivation is testable;
- light/dark themes and reduced-motion preference do not break the map surface.

Do not require production credentials or external deployment. Prefer deterministic local/offline fixtures. Run the harness, full unit suite and build. Commit and push only this branch with exact evidence and known gaps.

Start response: `ACK COMPOSER-2 MOBILE-A11Y`.

