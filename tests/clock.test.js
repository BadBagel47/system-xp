import { describe, it, expect } from 'vitest';
import { createClock, TIME_MIN, TIME_MAX, DAY_MS, SPEEDS } from '../src/clock.js';

describe('clock', () => {
  it('runs forwards and backwards at the chosen speed', () => {
    const c = createClock(Date.UTC(2000, 0, 1));
    c.playing = true;
    c.tick(2);
    expect(c.t).toBe(Date.UTC(2000, 0, 3));
    c.dir = -1;
    c.speed = 'year';
    c.tick(1);
    expect(c.t).toBe(Date.UTC(2000, 0, 3) - SPEEDS.year * DAY_MS);
  });

  it('stops at the ends of the range', () => {
    const c = createClock(TIME_MAX - DAY_MS);
    c.playing = true;
    c.speed = 'month';
    c.tick(1);
    expect(c.t).toBe(TIME_MAX);
    expect(c.playing).toBe(false);
    expect(createClock(0).t).toBe(TIME_MIN);
  });

  it('does not move while paused', () => {
    const c = createClock(Date.UTC(2010, 5, 1));
    expect(c.tick(10)).toBe(Date.UTC(2010, 5, 1));
  });
});
