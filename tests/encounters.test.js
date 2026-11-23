// Checks that probes and planets line up at famous close approaches.
// Uses the committed data files; skipped when they are missing.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { helioEcliptic, setPlanetCorrections } from '../src/astro.js';
import { positionAt, msToDays, daysToMs } from '../src/trajectory.js';

const AU_KM = 149597870.7;
const file = (p) => new URL(`../public/data/${p}`, import.meta.url);
const read = (p) => JSON.parse(readFileSync(file(p), 'utf8'));
const haveData = existsSync(file('planets.json')) && existsSync(file('probes/new-horizons.detail.json'));

function closest(probeFile, planet, isoTime, hours = 12) {
  const traj = read(`probes/${probeFile}`);
  const centre = msToDays(Date.parse(isoTime));
  let best = { km: Infinity, t: 0 };
  for (let m = -hours * 60; m <= hours * 60; m++) {
    const d = centre + m / 1440;
    const p = positionAt(traj, d);
    if (!p) continue;
    const e = helioEcliptic(planet, new Date(daysToMs(d)));
    const km = Math.hypot(p[0] - e.x, p[1] - e.y, p[2] - e.z) * AU_KM;
    if (km < best.km) best = { km, t: d };
  }
  return best;
}

describe.skipIf(!haveData)('close approaches (detailed data + planet corrections)', () => {
  beforeAll(() => setPlanetCorrections(read('planets.json').bodies));

  it('New Horizons passes about 13,700 km from the centre of Pluto on 14 July 2015', () => {
    const c = closest('new-horizons.detail.json', 'Pluto', '2015-07-14T11:50:00Z');
    expect(c.km).toBeGreaterThan(11000);
    expect(c.km).toBeLessThan(17000);
  });

  it('Voyager 2 passes about 29,000 km from the centre of Neptune on 25 August 1989', () => {
    const c = closest('voyager-2.detail.json', 'Neptune', '1989-08-25T03:56:00Z');
    expect(c.km).toBeGreaterThan(25000);
    expect(c.km).toBeLessThan(34000);
  });

  it('Juno skims about 4,000–5,000 km above Jupiter’s clouds on arrival (5 July 2016)', () => {
    const c = closest('juno.detail.json', 'Jupiter', '2016-07-05T02:50:00Z');
    expect(c.km).toBeGreaterThan(71000);
    expect(c.km).toBeLessThan(80000);
  });
});
