// Static data for the Sun, the planets and Pluto.
// Radii in km (IAU mean radii); colours are approximate visual tints.

export const AU_KM = 149597870.7;

export const SUN = {
  id: 'Sun',
  name: 'Sun',
  radiusKm: 695700,
  color: 0xffd27a,
  minPx: 9,
};

// `priority` decides which label wins when labels overlap (lower wins).
export const PLANETS = [
  { id: 'Mercury', name: 'Mercury', radiusKm: 2439.7, color: 0xa8a39d, minPx: 3.2, priority: 8 },
  { id: 'Venus', name: 'Venus', radiusKm: 6051.8, color: 0xe9d3a6, minPx: 4, priority: 7 },
  { id: 'Earth', name: 'Earth', radiusKm: 6371.0, color: 0x4a86d9, minPx: 4.2, priority: 3 },
  { id: 'Mars', name: 'Mars', radiusKm: 3389.5, color: 0xd0623a, minPx: 3.6, priority: 6 },
  { id: 'Jupiter', name: 'Jupiter', radiusKm: 69911, color: 0xd9b38c, minPx: 6, priority: 1 },
  { id: 'Saturn', name: 'Saturn', radiusKm: 58232, color: 0xe6d29a, minPx: 5.5, priority: 2, rings: true },
  { id: 'Uranus', name: 'Uranus', radiusKm: 25362, color: 0xa6dbe3, minPx: 4.8, priority: 4 },
  { id: 'Neptune', name: 'Neptune', radiusKm: 24622, color: 0x5b7fe8, minPx: 4.8, priority: 5 },
  { id: 'Pluto', name: 'Pluto', radiusKm: 1188.3, color: 0xcdb79e, minPx: 3, priority: 9, dwarf: true },
];

// Saturn's main rings, in units of Saturn's equatorial radius.
export const SATURN_RINGS = [
  { inner: 1.24, outer: 1.52, opacity: 0.18 }, // C ring
  { inner: 1.52, outer: 1.95, opacity: 0.6 }, // B ring
  { inner: 2.03, outer: 2.27, opacity: 0.42 }, // A ring (after the Cassini Division)
];
