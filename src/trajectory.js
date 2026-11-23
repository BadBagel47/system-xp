// Trajectory helpers shared by the page and the data script.
// Times are days since J2000 (JD 2451545.0 = 2000-01-01 12:00 TT); positions are
// heliocentric ecliptic J2000 coordinates in AU, stored flat: [x0, y0, z0, x1, ...].

export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const DAY_MS = 86400000;

export const msToDays = (ms) => (ms - J2000_MS) / DAY_MS;
export const daysToMs = (d) => J2000_MS + d * DAY_MS;

/**
 * Remove points that linear interpolation (in time) can reproduce within `tol` AU.
 * `tol` is a number or an array with one tolerance per sample.
 * Keeps the first and last point. `maxGapDays` limits the time between kept points.
 */
export function decimate(t, p, tol, maxGapDays = 60) {
  const tolAt = typeof tol === 'number' ? () => tol : (k) => tol[k];
  const n = t.length;
  if (n <= 2) return { t: [...t], p: [...p] };
  const keep = [0];
  let i = 0;
  const fits = (a, b) => {
    const dt = t[b] - t[a];
    if (dt > maxGapDays) return false;
    for (let k = a + 1; k < b; k++) {
      const f = (t[k] - t[a]) / dt;
      for (let c = 0; c < 3; c++) {
        const v = p[a * 3 + c] + (p[b * 3 + c] - p[a * 3 + c]) * f;
        if (Math.abs(v - p[k * 3 + c]) > tolAt(k)) return false;
      }
    }
    return true;
  };
  while (i < n - 1) {
    // Exponential search for a failing end point, then binary search back.
    let good = i + 1;
    let step = 1;
    let bad = -1;
    while (true) {
      const j = Math.min(i + step * 2, n - 1);
      if (fits(i, j)) {
        good = j;
        if (j === n - 1) break;
        step *= 2;
      } else {
        bad = j;
        break;
      }
    }
    if (bad !== -1) {
      let lo = good;
      let hi = bad;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (fits(i, mid)) lo = mid;
        else hi = mid;
      }
      good = lo;
    }
    keep.push(good);
    i = good;
  }
  const outT = keep.map((k) => t[k]);
  const outP = [];
  for (const k of keep) outP.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
  return { t: outT, p: outP };
}

/** Index of the last sample with time <= d (or -1 if d is before the first sample). */
export function sampleIndex(t, d) {
  if (d < t[0]) return -1;
  let lo = 0;
  let hi = t.length - 1;
  if (d >= t[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Position at time d (days since J2000), or null when outside the data and
 * `extrapolate` is false. Writes into `out` ([x, y, z]) and returns it.
 */
export function positionAt(traj, d, out = [0, 0, 0], extrapolate = false) {
  const { t, p } = traj;
  const n = t.length;
  if (d < t[0]) return null;
  let i = sampleIndex(t, d);
  if (i >= n - 1) {
    if (d === t[n - 1]) {
      out[0] = p[(n - 1) * 3];
      out[1] = p[(n - 1) * 3 + 1];
      out[2] = p[(n - 1) * 3 + 2];
      return out;
    }
    if (!extrapolate) return null;
    i = n - 2; // continue the last segment in a straight line
  }
  const f = (d - t[i]) / (t[i + 1] - t[i]);
  for (let c = 0; c < 3; c++) out[c] = p[i * 3 + c] + (p[(i + 1) * 3 + c] - p[i * 3 + c]) * f;
  return out;
}

/** Heliocentric velocity in AU/day at time d (from the segment around d). */
export function velocityAt(traj, d, out = [0, 0, 0]) {
  const { t, p } = traj;
  const n = t.length;
  let i = Math.max(0, Math.min(sampleIndex(t, d), n - 2));
  const dt = t[i + 1] - t[i];
  for (let c = 0; c < 3; c++) out[c] = (p[(i + 1) * 3 + c] - p[i * 3 + c]) / dt;
  return out;
}
