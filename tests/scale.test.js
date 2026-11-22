import { describe, it, expect } from 'vitest';
import { toDisplay, compressPoint, localScale, neighbourhood } from '../src/scale.js';

const len = (v) => Math.hypot(...v);

describe('scale', () => {
  it('leaves real scale untouched', () => {
    expect(toDisplay('real', [3, 4, 0], null)).toEqual([3, 4, 0]);
  });

  it('compresses distance to its square root and keeps the direction', () => {
    const v = compressPoint([30, 0, 0]);
    expect(v[0]).toBeCloseTo(Math.sqrt(30), 10);
    expect(len(compressPoint([0, 1, 0]))).toBeCloseTo(1, 10);
    expect(localScale('compressed', 4)).toBeCloseTo(0.5, 10);
    expect(localScale('real', 4)).toBe(1);
  });

  it('scales evenly around a nearby planet and blends smoothly further out', () => {
    const jupiter = [5.2, 0, 0];
    const lookup = (name) => (name === 'Jupiter' ? jupiter : [100, 100, 100]);
    const P = compressPoint(jupiter);
    const k = Math.sqrt(5.2) / 5.2;
    // A point 0.01 AU from Jupiter keeps its offset direction, scaled by k.
    const q = toDisplay('compressed', [5.2, 0.01, 0], lookup);
    expect(q[0]).toBeCloseTo(P[0], 6);
    expect(q[1]).toBeCloseTo(0.01 * k, 6);
    // Continuity across the outer edge of the neighbourhood.
    const { outer } = neighbourhood('Jupiter');
    const a = toDisplay('compressed', [5.2, outer - 1e-6, 0], lookup);
    const b = toDisplay('compressed', [5.2, outer + 1e-6, 0], lookup);
    expect(len([a[0] - b[0], a[1] - b[1], a[2] - b[2]])).toBeLessThan(1e-4);
  });
});
