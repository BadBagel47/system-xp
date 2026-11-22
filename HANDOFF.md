# HANDOFF – System Xp

- Agent rules version: 1.14
- Inventory: 2026-11-22 (new, empty repo: no branches, PRs, issues or earlier docs)
- Project language: English (product text and README). Working docs: Swedish/English.
- Publishing: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`), on every push to `main`. Live URL: https://badbagel47.github.io/system-xp/
- Backlog: [docs/BACKLOG.md](docs/BACKLOG.md). Project rules: [AGENTS.md](AGENTS.md).

## Goals and way of working
System Xp (experience + exploration) is a 3D simulator of the solar system and the most famous space probes. Starts on today's date, time can be scrolled forwards and backwards, probe journeys are shown from launch to today with a trail up to the chosen date. Must work equally well on phone and desktop. Agents push directly to `main`; the site goes live after every run.

## Current state
- F-001 (foundation) done: Sun, planets and Pluto at real positions for today, orbits, Saturn's rings, stars, labels, tap/click to centre a planet, "Overview" button, camera controls for touch and mouse.
- F-009 (clear message when 3D can't start) done: WebGL 2 check before start, message with tips (Brave Shields, hardware acceleration, other browser), handling of lost graphics context and render errors. Not tried in Brave on the user's Pixel 10 Pro.
- Tech: Vite + three.js + astronomy-engine, all bundled (no CDN). Unit tests with Vitest (`npm test`). Scene units: 1 = 1 AU, +Y = ecliptic north (J2000 ecliptic).
- Planets are drawn with a minimum on-screen size (`minPx` in `src/bodies.js`) and grow to true size when close.

## Next steps
See "Proposed runs" in the backlog. Next: F-002 (time controls), then F-003/F-004 (probes).
Note for F-003: commits pushed by a workflow with `GITHUB_TOKEN` do not trigger other workflows, so the data workflow must call `deploy.yml` itself (it supports `workflow_call`).

## Decisions
- 2026-11-22: Push directly to `main`; the site must go live after every run (user).
- 2026-11-22: three.js for 3D, astronomy-engine for planet positions (user).
- 2026-11-22: Probe positions come from NASA/JPL Horizons, fetched by a GitHub Action and stored as data files in the repo; the page never calls Horizons. The Action must be re-runnable to top up data for active probes (user).
- 2026-11-22: No cookie banner, no tracking services (user). Consequence: no cookies/localStorage for tracking, no analytics, no external fonts/CDNs.
- 2026-11-22: Product text and README in English (user).
- 2026-11-22: Publishing via GitHub Pages (user); method GitHub Actions (agent, technical choice).

## One-time actions
- Pending (2026-11-22): enable GitHub Pages with source "GitHub Actions" (Settings → Pages). The agent cannot change repo settings. Until done, the deploy job fails.

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
