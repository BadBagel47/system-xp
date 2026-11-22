# AGENTS.md – System Xp

Follow the global agent rules first: https://raw.githubusercontent.com/BadBagel47/agent-rules/main/AGENTS.md
If the link cannot be read, fetch `AGENTS.md` from the repo BadBagel47/agent-rules via GitHub instead. This is a web project, so WEB.md in the same repo also applies.

- Current state, decisions and next steps: [HANDOFF.md](HANDOFF.md)
- Backlog (bugs, features, proposed runs): [docs/BACKLOG.md](docs/BACKLOG.md)

## Project rules

- Product text (UI, error messages) and README are in English.
- The site must never call NASA/JPL Horizons (or any other external API) from the browser. Probe positions come from data files in the repo, produced by a GitHub Action.
- No cookies, no local tracking, no analytics or third-party trackers, no externally hosted fonts or scripts. All libraries are bundled from npm.
- Every change must work on a phone (one finger rotates, pinch zooms) as well as on desktop.
- If 3D cannot start, show a clear message – never a blank page.
