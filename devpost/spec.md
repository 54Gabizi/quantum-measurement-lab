---
doc: spec
status: implemented
---
# Technical Specification

## How It Works
A buildless HTML/CSS/JavaScript app renders an SVG Bloch sphere and computes ideal probabilities locally. Camera geometry, measurement state, sampling/arrivals, primer state, and guided-learning evidence are separate modules. No backend, account, storage, external API, or runtime dependency is needed.

## Components and Files
- index.html: semantic controls, result panels, primer, and guide.
- styles.css: responsive presentation, compact mobile receivers, particle overlay, reduced motion.
- src/quantum.mjs: normalized-vector Born probabilities and categorical sampling.
- src/geometry.mjs: camera basis, vector projection/unprojection, trackball geometry.
- src/experiment.mjs: fixed preparations, axis state, counts, and reset rules.
- src/runner.mjs: independent launches, guarded arrivals, cancellation, count commits.
- src/app.mjs: input handling, rendering, viewport destinations, guide integration.
- src/i18n.mjs: English interface copy.
- src/primer.mjs: independent bit/phase/single-outcome teaching state.
- src/tour.mjs: token-bound tour evidence, signed Z labels, theoretical challenge checks.
- tests/: model, event, cancellation, layout-coordinate, and teaching-state regressions.
- devpost/app-map.html: factual source-reference route and reusable testing practice.

## Data and Physics
Runtime data exists only in browser memory. State includes axis n, camera angles, counts, last outcomes, queued flights, and separate primer/tour state. Preparations are r=(±1,0,0); probabilities use (1±r·n)/2. Browser pseudorandom samples are classical simulation results. Every trial uses a fresh preparation.

## Arrival and Geometry Rules
Launch cadence is 65 ms. Visible flights have a 350 ms delay; counts commit only on guarded arrivals. Current viewport rectangles determine the sphere origin and matching desktop/mobile receiver. Off-screen or reduced-motion launches use immediate outcome updates. Scroll/resize/page hiding and geometry-changing panels cancel pending work rather than using stale coordinates.

## Guide Rules
Each actual run start has an opaque evidence token. Only the matching complete eligible 100-arrival run advances. Exit/restart invalidates guide evidence without changing physical state. The challenge uses deterministic model endpoints and completed current-setting measurements, never a lucky histogram. Tiny endpoint tolerance covers floating-point residue only.

## Run and Verify
Start from the project root with `python -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765` on the same machine. Run `node --test tests/*.test.mjs`; Node 24 was used. All 46 tests and source syntax checks pass. Event doubles are not a substitute for rendered-browser checks. This test suite verifies model and event behavior rather than rendered-browser appearance.

## External References
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- https://developer.mozilla.org/en-US/docs/Web/SVG
- https://nodejs.org/api/test.html
- https://docs.python.org/3/library/http.server.html
