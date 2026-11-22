# Backlog – System Xp

IDs: F- feature, B- bug, D- planning/design. Priority: High / Medium / Low.
The user's original feature list (1–6) is noted in brackets.

## Open

| ID | Priority | Status | Title |
|----|----------|--------|-------|
| F-010 | High | Waiting for user (one-time Pages setting) | Publishing via GitHub Pages after every push to main |
| F-002 | High | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Time controls [2] |
| F-003 | High | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Probe data from NASA/JPL Horizons via GitHub Action [3] |
| F-004 | High | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Probes in 3D with trails up to the chosen date [3] |
| F-005 | Medium | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Real vs. compressed scale [4] |
| F-006 | Medium | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Timeline events you can jump to [5] |
| F-007 | Medium | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Info panel when tapping a planet or probe [6] |
| F-008 | Medium | Pågår 2026-11-22 (session_019KYzr9B6MQwkqTnCDiKoiM) | Camera mode that follows a probe [6] |
| D-011 | Low | Open | Choose a licence for the code |

### F-010 – GitHub Pages publishing
`.github/workflows/deploy.yml` (tests, builds and publishes on every push to `main`; can be called by other workflows) is in place. First run 2026-11-22: tests and build passed, publishing stopped because Pages is not enabled. When the user has set Settings → Pages → Source to "GitHub Actions": re-run the workflow and check the live URL, then move to Done.

### F-002 – Time controls [2]
Date picker, play/pause, speeds (day/s, month/s, year/s), "Now" button. Scroll both forwards and backwards in time. Planets (and later probes) move accordingly; the camera keeps following the focused body (already supported).
- Question: which date range should the picker allow? Recommendation: 1 Jan 1970 – 31 Dec 2050 (covers every probe from Pioneer 10 in 1972 and the planned arrivals around 2030–2031).
- Question: should play also run backwards (e.g. −1 year/s)? Recommendation: yes, a direction toggle next to the speeds.

### F-003 – Probe data from NASA/JPL Horizons via GitHub Action [3]
A GitHub Action (manual run + schedule) fetches heliocentric ecliptic J2000 vectors from the Horizons API for: Voyager 1 (-31), Voyager 2 (-32), Pioneer 10 (-23), Pioneer 11 (-24), New Horizons (-98), Cassini (-82), Galileo (-77), Juno (-61), Parker Solar Probe (-96), JUICE (-28), Europa Clipper (-159). Saves compact data files in the repo (e.g. `public/data/probes/*.json`), from launch to end of mission or to the last date Horizons provides. Re-runs only top up active probes. Must call `deploy.yml` afterwards (pushes with GITHUB_TOKEN don't trigger workflows).
- Question: should planned future trajectories (beyond today) be shown when time is moved forward, e.g. Europa Clipper reaching Jupiter in 2030? Recommendation: yes, as a dashed "planned" line up to the end of Horizons' predictions.
- Question: how often should the Action top up data automatically? Recommendation: once a month, plus the manual "Run workflow" button.

### F-004 – Probes in 3D with trails [3]
Draw each probe as a marker with a label; draw its path from launch up to the chosen date (fading trail); hide probes before launch and after end of mission (show where it ended). Interpolate between data points. Builds on F-002 and F-003.

### F-005 – Real vs. compressed scale [4]
Toggle between real distances and a compressed scale (e.g. logarithmic-ish radial distance) so the outer planets and far probes fit together with the inner planets. Planets enlarged so they are visible (minimum on-screen size exists since F-001; make the enlargement factor consistent per mode).
- Question (later): which scale should be the default?

### F-006 – Timeline events [5]
A list/timeline of events, e.g. "Voyager 1 passes Jupiter, 1979", that jumps to the date and focuses the right body. Builds on F-002 and F-004.

### F-007 – Info panel [6]
Tapping a planet or probe opens a panel with key facts (distance from the Sun/Earth, speed, launch date, mission status). Builds on F-004 for probes.

### F-008 – Follow-a-probe camera [6]
Camera mode that follows a probe as time runs. Builds on F-004.

### D-011 – Choose a licence for the code
Without a licence file the code is "all rights reserved". Options: MIT (anyone may reuse), or no licence. The user decides.

## Done

| ID | Priority | Done | Title |
|----|----------|------|-------|
| F-001 | High | 2026-11-22 | Foundation: Sun + planets at the right place, camera controls [1] |
| F-009 | High | 2026-11-22 | Clear message when 3D (WebGL) can't start – e.g. Brave on Pixel 10 Pro |

### F-001 – Foundation [1]
Sun, 8 planets and Pluto at their real heliocentric positions for today (astronomy-engine), orbit lines, Saturn's rings with the real tilt, starfield, labels that avoid overlapping, tap/click to centre a planet, Overview button. Controls: one finger rotates, pinch zooms, two fingers pan; mouse drag/scroll/right-drag.

### F-009 – 3D start-up failure message
WebGL 2 check before starting, friendly message with tips for Brave/hardware acceleration/other browser and a "Try again" button; also handles a lost graphics context and render errors. Not yet tried in Brave on the user's Pixel 10 Pro.


## Proposed runs
Prioritised for: visible movement first, then the probes.
- **A** – strong model, high level – Time controls
  - F-002 – Date picker, play/pause, speeds and "Now", so you can travel through time
  - Question: date range? Recommendation: 1970–2050.
  - Question: play backwards too? Recommendation: yes.
- **B** – strong model, high level – Probe data pipeline
  - F-003 – GitHub Action that fetches all eleven probes from Horizons and stores data files, re-runnable
  - Question: show planned future paths? Recommendation: yes, dashed.
  - Question: automatic top-up? Recommendation: monthly + manual.
- **C** – strong model, high level – Probes in 3D – builds on A and B
  - F-004 – Probe markers, labels and trails up to the chosen date
- **D** – strong model, medium level – Scale, info panel and follow camera – builds on C
  - F-005 – Real/compressed scale toggle
  - F-007 – Info panel for planets and probes
  - F-008 – Camera that follows a probe
- **E** – strong model, medium level – Timeline events – builds on C
  - F-006 – Event list you can jump to
