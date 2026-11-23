import { describe, it, expect } from 'vitest';
import { fillHighLow } from '../src/rte-line.js';

describe('high/low split for precise lines', () => {
  it('keeps positions far from the Sun exact to well under a kilometre', () => {
    const AU_KM = 149597870.7;
    const pos = [33.123456789012, -12.000000123, 0.5, 170.25, 1e-9, -45.987654321];
    const high = new Float32Array(pos.length);
    const low = new Float32Array(pos.length);
    fillHighLow(pos, high, low);
    let worst = 0;
    for (let i = 0; i < pos.length; i++) {
      const plain = Math.abs(Math.fround(pos[i]) - pos[i]) * AU_KM;
      const split = Math.abs(high[i] + low[i] - pos[i]) * AU_KM;
      expect(split).toBeLessThan(0.001); // under a metre
      worst = Math.max(worst, plain);
    }
    expect(worst).toBeGreaterThan(1); // plain 32-bit floats are off by kilometres
  });
});
