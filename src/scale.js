// Real and compressed scale.
//
// Real: 1 scene unit = 1 AU.
// Compressed: the distance from the Sun is shown as its square root
// (Earth stays at 1, Jupiter 5.2 AU -> 2.3, Neptune 30 AU -> 5.5,
// Voyager 1 at 170 AU -> 13). Near a planet the space is scaled evenly
// around that planet instead, so orbits and flybys keep their shape.

export const SCALES = ['real', 'compressed'];

// Mean distance (a, AU) and eccentricity (e) – used to skip planets that are far away.
export const PLANET_ORBITS = {
  Mercury: { a: 0.387, e: 0.206 },
  Venus: { a: 0.723, e: 0.007 },
  Earth: { a: 1.0, e: 0.017 },
  Mars: { a: 1.524, e: 0.093 },
  Jupiter: { a: 5.203, e: 0.049 },
  Saturn: { a: 9.537, e: 0.057 },
  Uranus: { a: 19.19, e: 0.047 },
  Neptune: { a: 30.07, e: 0.009 },
  Pluto: { a: 39.48, e: 0.249 },
};

const radius = (v) => Math.hypot(v[0], v[1], v[2]);

/** Compressed radial map f(r) = sqrt(r). */
export const compressRadius = (r) => Math.sqrt(r);

/** How much the compressed scale enlarges space locally at distance r (f(r)/r). */
export function localScale(mode, r) {
  if (mode !== 'compressed') return 1;
  return 1 / Math.sqrt(Math.max(r, 0.05));
}

/** Pure radial compression of a point (AU) – no planet neighbourhoods. */
export function compressPoint(v, out = [0, 0, 0]) {
  const r = radius(v);
  if (r < 1e-12) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const s = compressRadius(r) / r;
  out[0] = v[0] * s;
  out[1] = v[1] * s;
  out[2] = v[2] * s;
  return out;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distances (AU) within which space is scaled evenly around a planet. */
export function neighbourhood(name) {
  const a = PLANET_ORBITS[name].a;
  return { inner: 0.03 * a, outer: 0.08 * a };
}

/**
 * Map a heliocentric point (AU) to display coordinates.
 * `planetAt(name)` returns the planet's heliocentric position at the same
 * moment; it is only called for planets whose orbit could be close.
 */
export function toDisplay(mode, v, planetAt, out = [0, 0, 0]) {
  if (mode !== 'compressed') {
    out[0] = v[0];
    out[1] = v[1];
    out[2] = v[2];
    return out;
  }
  compressPoint(v, out);
  if (!planetAt) return out;
  const r = radius(v);
  for (const name in PLANET_ORBITS) {
    const { a, e } = PLANET_ORBITS[name];
    const { inner, outer } = neighbourhood(name);
    if (Math.abs(r - a) > outer + a * e + 0.01) continue;
    const P = planetAt(name);
    if (!P) continue;
    const d = Math.hypot(v[0] - P[0], v[1] - P[1], v[2] - P[2]);
    if (d >= outer) continue;
    const w = 1 - smoothstep(inner, outer, d);
    const rp = radius(P);
    const k = compressRadius(rp) / rp;
    for (let c = 0; c < 3; c++) {
      const local = P[c] * k + (v[c] - P[c]) * k;
      out[c] = w * local + (1 - w) * out[c];
    }
    break;
  }
  return out;
}
