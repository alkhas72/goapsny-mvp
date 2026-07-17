# Z player B — isolated MapLibre component lane

Role: sole product writer for branch `feat/epoch3-maplibre-z`. You are not the conductor.

## Canon

- Base: `456a0130fb2d996211e2d02af2b784a92a1fc99d`.
- Read `.ui-craft/brief.md`, `.ui-craft/tokens.md`, and `DESIGN.md` before UI work.
- No redesign. The June interface remains the product face.
- This lane owns only the map-component boundary: map rendering, pins and selected pin, centering, live geolocation and explicit location toggle, movable pin during add, light/dark themes.
- Do not change auth, roles, forms, Supabase contracts, navigation, or application shell.
- Do not integrate into the common shell until the Leaflet parity gate is green.
- Production, main, secrets and external publication are forbidden.

## Objective — parallel adapter with tests

Use TDD. Inspect the existing `LeafletMap` contract and preserved MapLibre work already present in repository history/branches without merging it wholesale. Produce a narrow MapLibre adapter and contract tests that can later replace Leaflet behind the same props/events.

Required behavior:

1. stable pins and selected-pin state;
2. correct Abkhazia default bounds without overriding precise live location;
3. explicit user control to activate/deactivate location tracking;
4. no automatic permission prompt on initial public map load;
5. movable draft pin during place creation;
6. light/dark map theme compatibility;
7. accessible controls and ≥44×44 px targets.

Required evidence: focused tests, complete test suite, build, exact changed files, adapter API and integration risks. Commit and push only this branch. Do not merge anywhere.

Timebox: first factual checkpoint after 90 minutes; hard 4 hours to isolated component evidence. If the shell contract is ambiguous, freeze the adapter API and tests rather than guessing product behavior.

First response: `ACK Z-PLAYER-B MAPLIBRE feat/epoch3-maplibre-z`.

