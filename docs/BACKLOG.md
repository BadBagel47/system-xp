# Backlog – System Xp

IDs: F- feature, B- bug, D- planning/design. Priority: High / Medium / Low.
The user's original feature list (1–6) is noted in brackets.

## Open

| ID | Priority | Status | Title |
|----|----------|--------|-------|
| D-014 | Low | Open – question for the user | Default scale when the page opens |
| F-012 | Low | Open | Slower speed (hour/s) to watch flybys |
| F-013 | Low | Open | Finer trajectory detail close to planets |
| D-011 | Low | Open – question for the user | Choose a licence for the code |

### D-014 – Default scale
The page opens in real scale; compressed is one tap away (F-005).
- Question: which scale should the page open in? Recommendation: keep real scale (true distances first; compressed is one tap away).

### F-012 – Slower speed for flybys
At day/s a flyby (e.g. Voyager 1 at Jupiter) passes in about a second. An extra speed such as hour/s would let you watch it. Idea from the agent, not requested.

### F-013 – Finer trajectory detail close to planets
Data is sampled hourly around flybys and orbits and thinned to ~30,000 km. Zoomed far in on Juno/Cassini/Galileo orbits the closest passes look angular, and the planet position (Astronomy Engine) and the probe path (Horizons) can differ by a fraction of a planet radius. Option: 10-minute sampling and a tighter tolerance within a few planet radii (bigger data files).

### D-011 – Choose a licence for the code
Without a licence file the code is "all rights reserved". Options: MIT (anyone may reuse), or no licence. The user decides.

## Done

| ID | Priority | Done | Title |
|----|----------|------|-------|
| F-001 | High | 2026-11-22 | Foundation: Sun + planets at the right place, camera controls [1] |
| F-009 | High | 2026-11-22 | Clear message when 3D (WebGL) can't start – e.g. Brave on Pixel 10 Pro |
| F-002 | High | 2026-11-22 | Time controls [2] |
| F-003 | High | 2026-11-22 | Probe data from NASA/JPL Horizons via GitHub Action [3] |
| F-004 | High | 2026-11-22 | Probes in 3D with trails up to the chosen date [3] |
| F-005 | Medium | 2026-11-22 | Real vs. compressed scale [4] |
| F-006 | Medium | 2026-11-22 | Timeline events you can jump to [5] |
| F-007 | Medium | 2026-11-22 | Info panel when tapping a planet or probe [6] |
| F-008 | Medium | 2026-11-22 | Camera mode that follows a probe [6] |
| F-010 | High | 2026-11-22 | Publishing via GitHub Pages after every push to main |

### F-001 – Foundation [1]
Sun, 8 planets and Pluto at their real heliocentric positions (astronomy-engine), orbit lines, Saturn's rings with the real tilt, starfield, labels that avoid overlapping, tap/click to centre, Overview button. Controls: one finger rotates, pinch zooms, two fingers pan; mouse drag/scroll/right-drag.

### F-009 – 3D start-up failure message
WebGL 2 check before starting, friendly message with tips for Brave/hardware acceleration/other browser and a "Try again" button; also handles a lost graphics context and render errors. Not yet tried in Brave on the user's Pixel 10 Pro.

### F-002 – Time controls [2]
Date field (native date picker), timeline slider 1970–2050 with event ticks and a "now" marker, play/pause, backwards toggle, Day/s – Month/s – Year/s, Now button. Space = play/pause. Decisions: range 1970–2050, can play backwards.

### F-003 – Probe data [3]
`scripts/fetch-probes.mjs` + `.github/workflows/update-probe-data.yml`: Horizons vectors (Sun-centred, ecliptic J2000), adaptive sampling (daily, hourly where the path bends), thinned to ~30,000 km. Runs monthly and on demand; refreshes active probes (or all), commits `public/data/probes/*.json`, then republishes via `deploy.yml`. Each file records when it was generated; later positions are predictions.

### F-004 – Probes in 3D [3]
Markers, labels and trails up to the chosen date; predicted part dashed; hidden before launch; Cassini/Galileo disappear at mission end; Voyagers/Pioneers/New Horizons continue in a straight line after the data ends; others hidden after their data ends. The focused probe's trail is drawn stronger.

### F-005 – Scale [4]
Real (1 unit = 1 AU) or compressed (distance from the Sun → square root; near a planet space is scaled evenly around it so orbits and flybys keep their shape). Planets and probes always have a minimum on-screen size.

### F-006 – Events [5]
52 events (launches, flybys, arrivals, milestones); flyby times checked against the Horizons data. Tapping one pauses, jumps to the time, follows the probe at a suitable distance and shows a banner; future events are marked "Planned".

### F-007 – Info panel [6]
Sun/planets: distance from the Sun and Earth, orbital period, radius. Probes: agency, launch date, status (not launched / ended / predicted / extrapolated), distances, speed relative to the Sun, signal time to Earth, summary, data credit. Updates live. On phones it is a bottom panel and the 3D view shifts up so the probe stays visible.

### F-010 – GitHub Pages publishing
`.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`; also called by the data update workflow. Live since 2026-11-22 after the user enabled Pages (source: GitHub Actions); checked in a phone-sized browser (3D starts, 11 probes load, only github.io is contacted).

### F-008 – Follow a probe [6]
"Follow" in the info panel and the Probes list: centres and zooms to the probe and keeps it centred while time runs.

## Proposed runs
Prioritised for: getting the site live first, then small improvements.
- **A** – strong model, medium level – Watching flybys
  - F-012 – Add an hour/s speed so flybys can be followed
- **B** – strong model, high level – Detail near planets
  - F-013 – Finer sampling and tolerance close to planets
- **C** – standard model, low level – Default scale and licence – waits for answers
  - D-014 – Set the default scale. Question: which? Recommendation: real.
  - D-011 – Add a licence file. Question: MIT or none? No recommendation – it depends on whether others may reuse the code.
