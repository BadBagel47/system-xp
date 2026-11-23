# System Xp

**System Xp** – *experience + exploration* – is a 3D simulator of the solar system and the journeys of the most famous space probes, running in your browser.

Live site: https://badbagel47.github.io/system-xp/

## What it does

- The Sun, the eight planets and Pluto in 3D, at their real positions (Astronomy Engine), with orbits and Saturn's tilted rings.
- **Eleven space probes** – Voyager 1 & 2, Pioneer 10 & 11, New Horizons, Cassini, Galileo, Juno, Parker Solar Probe, JUICE and Europa Clipper – with the path they have flown up to the chosen date. The part of a path that is still a prediction is dashed.
- **Time travel:** starts today; pick any date from 1970 to 2050, drag the timeline, play forwards or backwards at an hour, a day, a month or a year per second, and jump back with **Now**.
- **Events:** a list of 50+ milestones (launches, flybys, arrivals, “Pale Blue Dot”…) – tap one to jump there with the camera on the probe. Ticks on the timeline show when they happen.
- **Real or compressed scale:** real distances, or a compressed view (distance from the Sun shown as its square root) where the inner planets, the giants and the far probes fit together. Planets and probes are always drawn large enough to see.
- **Info panel** for the Sun, planets and probes: distance from the Sun and Earth, speed, radio signal time, mission summary. **Follow** keeps the camera on a probe while time runs.
- Works on phones and desktops:
  - **Phone:** one finger rotates, pinch zooms, two fingers pan, tap a planet or probe.
  - **Desktop:** drag to rotate, scroll to zoom, right-drag to pan, click a planet or probe; Space plays/pauses, Esc closes panels.
- A clear message instead of a blank page if the browser can't start 3D (WebGL 2).

## Probe data

Trajectories come from [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) and are stored as small JSON files in `public/data/probes/`. The page never calls Horizons itself. The GitHub Action **Update probe data** (`.github/workflows/update-probe-data.yml`) runs `scripts/fetch-probes.mjs` on the 2nd of every month and on demand (Actions → Update probe data → Run workflow). It re-fetches the active probes (tick “all” to fetch every probe), commits the files and republishes the site.

Positions are heliocentric, in the ecliptic J2000 frame, times in UT. Sampling is adaptive (hourly where the path bends, every 10 minutes close to planets). Each probe has a light file (within ~30,000 km of the Horizons path, loaded at start) and a detailed file (a few hundred km near planets, loaded when you look there). `public/data/planets.json` holds small Horizons corrections to the Astronomy Engine planet positions, so planets and probes line up exactly at flybys.

## Privacy

No cookies, no analytics, no trackers. Everything is served from GitHub Pages; no third-party services are contacted by the page.

## Development

Requires Node.js 22.

```sh
npm install
npm run dev      # local development server
npm test         # unit tests
npm run build    # production build in dist/
node scripts/fetch-probes.mjs --all   # download all probe trajectories (needs internet)
```

Every push to `main` is tested, built and published to GitHub Pages by `.github/workflows/deploy.yml`.

## Credits

- [three.js](https://threejs.org/) – 3D rendering (MIT licence)
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross – planet positions (MIT licence)
- Probe trajectories: [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), Solar System Dynamics Group, Jet Propulsion Laboratory
