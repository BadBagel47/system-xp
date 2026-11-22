import { describe, it, expect } from 'vitest';
import { helioEcliptic, scenePosition, orbitPoints, northPoleScene, eclipticToScene } from '../src/astro.js';
import { PLANETS } from '../src/bodies.js';

const len = (v) => Math.hypot(...v);

describe('planet positions', () => {
  const date = new Date('2026-11-22T12:00:00Z');

  it('puts every planet at a plausible distance from the Sun', () => {
    const expected = { Mercury: [0.3, 0.47], Venus: [0.71, 0.73], Earth: [0.98, 1.02], Mars: [1.38, 1.67],
      Jupiter: [4.9, 5.5], Saturn: [9.0, 10.1], Uranus: [18.2, 20.1], Neptune: [29.7, 30.4], Pluto: [29.6, 49.4] };
    for (const p of PLANETS) {
      const r = len(scenePosition(p.id, date));
      expect(r, p.id).toBeGreaterThan(expected[p.id][0]);
      expect(r, p.id).toBeLessThan(expected[p.id][1]);
    }
  });

  it('places Earth opposite the Sun as seen from Earth (longitude check, 2000-03-20 equinox)', () => {
    // Near the March equinox the Sun is at ecliptic longitude 0°, so Earth is at ~180°.
    const e = helioEcliptic('Earth', new Date('2000-03-20T07:35:00Z'));
    const lon = (Math.atan2(e.y, e.x) * 180) / Math.PI;
    expect(Math.abs(Math.abs(lon) - 180)).toBeLessThan(0.1);
  });

  it('keeps planets close to the ecliptic plane (scene y is ecliptic north)', () => {
    const e = scenePosition('Earth', date);
    expect(Math.abs(e[1])).toBeLessThan(0.001);
  });

  it('maps ecliptic to scene with a proper rotation', () => {
    const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));
    near(eclipticToScene({ x: 1, y: 0, z: 0 }), [1, 0, 0]);
    near(eclipticToScene({ x: 0, y: 1, z: 0 }), [0, 0, -1]);
    near(eclipticToScene({ x: 0, y: 0, z: 1 }), [0, 1, 0]);
  });
});

describe('orbits', () => {
  it('returns a closed-looking orbit for Mars', () => {
    const pts = orbitPoints('Mars', new Date('2026-01-01T00:00:00Z'), 360);
    expect(pts.length).toBe(360 * 3);
    const first = [pts[0], pts[1], pts[2]];
    const n = pts.length;
    const last = [pts[n - 3], pts[n - 2], pts[n - 1]];
    const gap = len(first.map((v, i) => v - last[i]));
    expect(gap).toBeLessThan(0.05);
  });
});

describe('Saturn pole', () => {
  it('is tilted about 27° from the orbit normal', () => {
    const pole = northPoleScene('Saturn', new Date('2026-11-22T00:00:00Z'));
    const tiltFromEclipticNorth = (Math.acos(pole[1] / len(pole)) * 180) / Math.PI;
    expect(tiltFromEclipticNorth).toBeGreaterThan(25);
    expect(tiltFromEclipticNorth).toBeLessThan(30);
  });
});
