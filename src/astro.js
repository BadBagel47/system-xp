// Astronomy helpers built on astronomy-engine.
// All positions are heliocentric, in AU, in the J2000 ecliptic frame,
// then mapped to scene coordinates where +Y is ecliptic north.

import * as Astronomy from 'astronomy-engine';

const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

/** Heliocentric ecliptic J2000 position of a body, in AU. */
export function helioEcliptic(bodyId, date) {
  const body = Astronomy.Body[bodyId];
  if (!body) throw new Error(`Unknown body: ${bodyId}`);
  const eqj = Astronomy.HelioVector(body, date);
  const ecl = Astronomy.RotateVector(EQJ_TO_ECL, eqj);
  return { x: ecl.x, y: ecl.y, z: ecl.z };
}

/**
 * Ecliptic (x toward the March equinox, y 90° east, z north)
 * to scene coordinates (x, y up, z). This is a proper rotation.
 */
export function eclipticToScene(v) {
  return [v.x, v.z, -v.y];
}

/** Scene position of a body, in AU. */
export function scenePosition(bodyId, date) {
  return eclipticToScene(helioEcliptic(bodyId, date));
}

/** Sidereal orbital period in days. */
export function orbitalPeriodDays(bodyId) {
  return Astronomy.PlanetOrbitalPeriod(Astronomy.Body[bodyId]);
}

/**
 * Points along one full orbit, centred on `date`, in scene coordinates.
 * Returns a flat Float32Array [x0, y0, z0, x1, ...].
 */
export function orbitPoints(bodyId, date, segments = 360) {
  const period = orbitalPeriodDays(bodyId);
  const start = date.getTime() - (period / 2) * 86400000;
  const out = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const t = new Date(start + (i / segments) * period * 86400000);
    const p = scenePosition(bodyId, t);
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}

/** Direction of a body's north rotation pole in scene coordinates (unit vector). */
export function northPoleScene(bodyId, date) {
  const axis = Astronomy.RotationAxis(Astronomy.Body[bodyId], date);
  const ecl = Astronomy.RotateVector(EQJ_TO_ECL, axis.north);
  return eclipticToScene(ecl);
}
