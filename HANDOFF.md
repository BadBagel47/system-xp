# HANDOFF – System Xp

- Agent rules version: 1.14
- Inventory: 2026-11-22 (new, empty repo: no branches, PRs, issues or earlier docs)
- Project language: English (product text and README). Working docs: Swedish/English.
- Publishing: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`), on every push to `main`. Live URL: https://badbagel47.github.io/system-xp/
- Backlog: [docs/BACKLOG.md](docs/BACKLOG.md). Project rules: [AGENTS.md](AGENTS.md).

## Goals and way of working
System Xp (experience + exploration) is a 3D simulator of the solar system and the most famous space probes. Starts on today's date, time can be scrolled forwards and backwards, probe journeys are shown from launch to today with a trail up to the chosen date. Must work equally well on phone and desktop. Agents push directly to `main`; the site goes live after every run.

## Current state
- All six original features are built (F-001–F-008) plus F-009 (3D start-up message). See the backlog for details.
- Tech: Vite + three.js + astronomy-engine, all bundled (no CDN). Unit tests with Vitest (`npm test`). Scene units: 1 = 1 AU in real scale, +Y = ecliptic north (J2000 ecliptic).
- Code map: `src/app.js` (3D scene, camera, probes, trails), `src/ui.js` (dock, lists, info panel), `src/clock.js` (time), `src/scale.js` (real/compressed), `src/events.js` (timeline events), `src/probe-catalog.js` (probe list, shared with the data script), `src/trajectory.js` (decimation/interpolation), `scripts/fetch-probes.mjs` (Horizons download).
- Probe data: `public/data/probes/*.json`, written by the GitHub Action "Update probe data" (monthly + manual). Each file has `generatedAt`; positions after that are drawn dashed as predictions.
- Live at https://badbagel47.github.io/system-xp/ (F-010).
- Verified in headless Chromium (software WebGL) at desktop and phone size. Not tried on a real phone or in Brave.

## Next steps
See "Proposed runs" in the backlog (F-012, F-013, D-014, D-011).

## Decisions
- 2026-11-22: Push directly to `main`; the site must go live after every run (user).
- 2026-11-22: three.js for 3D, astronomy-engine for planet positions (user).
- 2026-11-22: Probe positions come from NASA/JPL Horizons, fetched by a GitHub Action and stored as data files in the repo; the page never calls Horizons. The Action must be re-runnable to top up data for active probes (user).
- 2026-11-22: No cookie banner, no tracking services (user). Consequence: no cookies/localStorage for tracking, no analytics, no external fonts/CDNs.
- 2026-11-22: Product text and README in English (user).
- 2026-11-22: Publishing via GitHub Pages (user); method GitHub Actions (agent, technical choice).
- 2026-11-22: Time range 1970–2050; time can also play backwards (user approved recommendations, F-002).
- 2026-11-22: Planned (future) probe paths are shown dashed; probe data is topped up automatically once a month plus a manual run button (user approved recommendations, F-003).
- 2026-11-22: Compressed scale = square root of the distance from the Sun, with even scaling around planets (agent, technical choice within F-005). Default scale is still open (D-014).

## One-time actions
- Done (2026-11-22): GitHub Pages enabled with source "GitHub Actions" by the user. The site now goes live on every push to main.

## Environment notes (2026-11-22)
- Agent can push to `main` over git and read/trigger Actions via the GitHub MCP tools; no `gh` API access and no access to repo settings.
- NASA/JPL Horizons API is reachable from the agent environment (useful for testing F-003 scripts).
- Verification is done in headless Chromium (software WebGL) at desktop and phone sizes; no real phones and no Brave available.

## Legal/privacy review (2026-11-22)
- No cookies or similar storage, no personal data processed by the site. GitHub (the host) logs visitor IP addresses as part of GitHub Pages – covered by GitHub's own privacy statement.
- Libraries: three.js and astronomy-engine, both MIT – credited in README. Horizons data (planned) is from NASA/JPL; credit it in the UI/README when added.
- No textures/images/fonts from third parties are used. If planet textures are added later, check their licence first.
- The repo has no licence file yet (see D-011).

## Latest entries
- 2026-11-22: Repo set up according to agent rules v1.14; F-001 and F-009 built and pushed. First deploy run: tests + build OK, publishing blocked until Pages is enabled (F-010).
- 2026-11-22: Pages enabled by the user; site published and checked (F-010).
- 2026-11-22: "Kör alla rek": F-002–F-008 built (time, probes, scale, events, info, follow). Probe data committed by the Update probe data Action.
