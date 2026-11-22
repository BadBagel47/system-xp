import { describe, it, expect } from 'vitest';
import { formatDistance, formatLightTime, formatDate, formatPeriod } from '../src/format.js';

describe('format', () => {
  it('formats distances, light time, dates and periods', () => {
    expect(formatDistance(1)).toBe('1.00 AU · 150 million km');
    expect(formatDistance(30.2)).toBe('30.2 AU · 4.52 billion km');
    expect(formatDistance(0.001)).toBe('150,000 km');
    expect(formatLightTime(1)).toBe('8 min');
    expect(formatLightTime(29.6)).toBe('4 h 6 min');
    expect(formatDate(Date.UTC(1979, 2, 5, 12))).toBe('5 Mar 1979');
    expect(formatPeriod(365.25 * 11.86)).toBe('11.9 years');
  });
});
