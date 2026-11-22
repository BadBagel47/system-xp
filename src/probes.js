// Loads the probe trajectory files produced by scripts/fetch-probes.mjs.

import { PROBES } from './probe-catalog.js';

const BASE = `${import.meta.env.BASE_URL}data/probes/`;

/** Returns [{ probe, traj }] for every probe whose data could be loaded. */
export async function loadProbeData() {
  const res = await fetch(`${BASE}index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Probe index: HTTP ${res.status}`);
  const index = await res.json();
  const results = await Promise.all(
    PROBES.map(async (probe) => {
      const entry = index.probes?.[probe.id];
      if (!entry) return null;
      try {
        const r = await fetch(`${BASE}${entry.file}?v=${entry.generated}`);
        if (!r.ok) return null;
        const data = await r.json();
        return { probe, traj: { t: data.t, p: data.p, generated: data.generatedAt || `${data.generated}T00:00:00Z` } };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}
