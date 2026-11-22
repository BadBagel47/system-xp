import { describe, it, expect } from 'vitest';
import { decimate, positionAt, sampleIndex, velocityAt, msToDays, daysToMs } from '../src/trajectory.js';

describe('decimate', () => {
  it('keeps a straight line as two points and reproduces a curve within tolerance', () => {
    const t = [];
    const line = [];
    const circle = [];
    for (let i = 0; i <= 200; i++) {
      t.push(i * 0.1);
      line.push(i * 0.01, 0, 0);
      const a = (i / 200) * Math.PI;
      circle.push(Math.cos(a), Math.sin(a), 0);
    }
    expect(decimate(t, line, 1e-6, 1000).t).toEqual([0, t[200]]);
    const thin = decimate(t, circle, 1e-3, 1000);
    expect(thin.t.length).toBeLessThan(60);
    // Every original sample is reproduced within the tolerance.
    for (let i = 0; i <= 200; i++) {
      const p = positionAt(thin, t[i]);
      expect(Math.hypot(p[0] - circle[i * 3], p[1] - circle[i * 3 + 1])).toBeLessThan(1.5e-3);
    }
  });

  it('respects the maximum gap', () => {
    const t = Array.from({ length: 101 }, (_, i) => i);
    const p = t.flatMap((v) => [v, 0, 0]);
    const thin = decimate(t, p, 1, 30);
    for (let i = 1; i < thin.t.length; i++) expect(thin.t[i] - thin.t[i - 1]).toBeLessThanOrEqual(30);
  });
});

describe('interpolation', () => {
  const traj = { t: [0, 10, 20], p: [0, 0, 0, 10, 0, 0, 10, 10, 0] };
  it('interpolates linearly and stops at the data end unless asked to extrapolate', () => {
    expect(positionAt(traj, 5)).toEqual([5, 0, 0]);
    expect(positionAt(traj, 15)).toEqual([10, 5, 0]);
    expect(positionAt(traj, -1)).toBeNull();
    expect(positionAt(traj, 25)).toBeNull();
    expect(positionAt(traj, 25, [0, 0, 0], true)).toEqual([10, 15, 0]);
    expect(sampleIndex(traj.t, 10)).toBe(1);
    expect(velocityAt(traj, 12)).toEqual([0, 1, 0]);
  });

  it('converts between ms and days since J2000', () => {
    expect(msToDays(Date.UTC(2000, 0, 1, 12))).toBe(0);
    expect(daysToMs(1)).toBe(Date.UTC(2000, 0, 2, 12));
  });
});
