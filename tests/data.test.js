import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EVENTS } from '../src/events.js';
import { PROBES, PROBE_BY_ID } from '../src/probe-catalog.js';
import { TIME_MIN, TIME_MAX } from '../src/clock.js';
import { msToDays } from '../src/trajectory.js';

const dataPath = (id) => new URL(`../public/data/probes/${id}.json`, import.meta.url);

describe('events', () => {
  it('are in time order, inside the time range and refer to known probes', () => {
    for (let i = 0; i < EVENTS.length; i++) {
      const e = EVENTS[i];
      expect(Number.isNaN(e.time), e.title).toBe(false);
      expect(e.time).toBeGreaterThanOrEqual(TIME_MIN);
      expect(e.time).toBeLessThanOrEqual(TIME_MAX);
      expect(PROBE_BY_ID[e.probe], e.title).toBeTruthy();
      if (i > 0) expect(e.time, e.title).toBeGreaterThanOrEqual(EVENTS[i - 1].time);
    }
  });

  it('fall within the probe trajectory data when the data is present', () => {
    for (const e of EVENTS) {
      if (!existsSync(dataPath(e.probe))) continue;
      const d = JSON.parse(readFileSync(dataPath(e.probe), 'utf8'));
      const day = msToDays(e.time);
      const probe = PROBE_BY_ID[e.probe];
      expect(day, e.title).toBeGreaterThanOrEqual(d.t[0]);
      if (probe.afterData !== 'extrapolate') expect(day, e.title).toBeLessThanOrEqual(d.t[d.t.length - 1] + 0.01);
    }
  });
});

describe('probe data files', () => {
  it('have matching time and position arrays, sorted in time', () => {
    for (const p of PROBES) {
      if (!existsSync(dataPath(p.id))) continue;
      const d = JSON.parse(readFileSync(dataPath(p.id), 'utf8'));
      expect(d.p.length).toBe(d.t.length * 3);
      for (let i = 1; i < d.t.length; i++) expect(d.t[i]).toBeGreaterThan(d.t[i - 1]);
    }
  });
});
