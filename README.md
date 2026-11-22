# System Xp

**System Xp** – *experience + exploration* – is a 3D simulator of the solar system and the journeys of the most famous space probes, running in your browser.

Live site: https://badbagel47.github.io/system-xp/

## What it does today

- The Sun, the eight planets and Pluto in 3D, at their real positions for today's date.
- Orbits for every planet, Saturn's rings tilted the way they really are.
- Planets are drawn larger than life so they stay visible, and grow to their true size when you zoom in close.
- Camera controls that work on both phone and desktop:
  - **Phone:** drag with one finger to rotate, pinch to zoom, two fingers to pan, tap a planet to centre it.
  - **Desktop:** drag to rotate, scroll to zoom, right-drag to pan, click a planet to centre it.
- A clear message instead of a blank page if the browser can't start 3D (WebGL 2).

Planned: a time machine (scroll forwards and backwards through time), the trajectories of Voyager 1 & 2, Pioneer 10 & 11, New Horizons, Cassini, Galileo, Juno, Parker Solar Probe, JUICE and Europa Clipper, real vs. compressed scale, a timeline of mission events, and info panels. See [docs/BACKLOG.md](docs/BACKLOG.md).

## Privacy

No cookies, no analytics, no trackers. Everything is served from GitHub Pages; no third-party services are contacted by the page.

## Development

Requires Node.js 22.

```sh
npm install
npm run dev      # local development server
npm test         # unit tests
npm run build    # production build in dist/
```

Every push to `main` is tested, built and published to GitHub Pages by `.github/workflows/deploy.yml`.

## Credits

- [three.js](https://threejs.org/) – 3D rendering (MIT licence)
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross – planet positions (MIT licence)
- Probe trajectories (planned): [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
