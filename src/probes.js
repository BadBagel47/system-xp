// Loads the data files produced by scripts/fetch-probes.mjs:
// planet corrections, probe trajectories and (on demand) detailed trajectories.

import { PROBES } from './probe-catalog.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

const toTraj = (data) => ({
  t: data.t,
  p: data.p,
  generated: data.generatedAt || `${data.generated}T00:00:00Z`,
});

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

/** The probe index: which files exist and which planets each probe passes close to. */
export async function loadProbeIndex() {
  const r = await fetch(`${BASE}probes/index.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Probe index: HTTP ${r.status}`);
  return r.json();
}

/** Horizons-minus-Astronomy-Engine corrections per planet, or null. */
export async function loadPlanetCorrections(index) {
  if (!index.planets) return null;
  try {
    const data = await getJson(`${index.planets}?v=${index.probes?.['voyager-1']?.generated ?? ''}`);
    return data.bodies;
  } catch {
    return null;
  }
}

/** Returns [{ probe, traj, detail, near }] for every probe whose data could be loaded. */
export async function loadProbeData(index) {
  const results = await Promise.all(
    PROBES.map(async (probe) => {
      const entry = index.probes?.[probe.id];
      if (!entry) return null;
      try {
        const data = await getJson(`probes/${entry.file}?v=${entry.generated}`);
        return { probe, traj: toTraj(data), detail: entry.detail ? `${entry.detail}?v=${entry.generated}` : null, near: entry.near || [] };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

/** The detailed trajectory of one probe (more points close to planets). */
export async function loadDetail(file) {
  return toTraj(await getJson(`probes/${file}`));
}
