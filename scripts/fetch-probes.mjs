#!/usr/bin/env node
// Downloads probe trajectories from the NASA/JPL Horizons API and writes
// compact data files to public/data/probes/. Run by the GitHub Action
// .github/workflows/update-probe-data.yml – the web page never calls Horizons.
//
// Usage:
//   node scripts/fetch-probes.mjs            # probes marked active + any missing file
//   node scripts/fetch-probes.mjs --all      # every probe
//   node scripts/fetch-probes.mjs --only voyager-1,juno
//
// Positions: heliocentric (Sun centre), ecliptic J2000 frame, AU.
// Sampling is adaptive: a coarse pass finds where the path bends sharply
// (flybys, orbits, perihelia), those windows are re-fetched hourly, and the
// result is thinned to what straight segments can reproduce within TOL_AU.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROBES } from '../src/probe-catalog.js';
import { decimate } from '../src/trajectory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data', 'probes');
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const JD_J2000 = 2451545.0;
const LIMIT_END_JD = 2470172.5; // 2051-01-01 – a little beyond the time slider's end
const TOL_AU = 2e-4; // ~30,000 km
const COARSE_STEP_H = 24;
const FINE_STEP_H = 1;
const MAX_STEPS_PER_REQUEST = 20000;

const args = process.argv.slice(2);
const all = args.includes('--all');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg ? (onlyArg.split('=')[1] ?? args[args.indexOf(onlyArg) + 1]).split(',') : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One Horizons API call. Network/HTTP problems are retried; an answer from
 * Horizons itself (data or an error message such as "No ephemeris ... after")
 * is returned as { result, error }.
 */
async function horizonsRaw(params, attempt = 1) {
  const url = new URL(API);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, `'${v}'`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'system-xp-data-update' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { result: json.result ?? '', error: json.error ?? '' };
  } catch (err) {
    if (attempt >= 5) throw err;
    await sleep(3000 * attempt);
    return horizonsRaw(params, attempt + 1);
  } finally {
    await sleep(250); // be gentle with the public API
  }
}

async function horizons(params) {
  const { result, error } = await horizonsRaw(params);
  if (error) throw new Error(error);
  return result;
}

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function parseHorizonsDate(s) {
  const m = s.match(/(\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/i);
  if (!m) return null;
  const ms = Date.UTC(+m[1], MONTHS[m[2].toUpperCase()], +m[3], +m[4], +m[5], +m[6]);
  return ms / 86400000 + 2440587.5;
}

/** Find the time span Horizons has data for (as JD). */
async function coverage(id) {
  const base = { COMMAND: id, EPHEM_TYPE: 'VECTORS', CENTER: '500@10', OBJ_DATA: 'NO', STEP_SIZE: '1d' };
  const early = await horizonsRaw({ ...base, START_TIME: '1950-01-01', STOP_TIME: '1950-01-02' });
  const late = await horizonsRaw({ ...base, START_TIME: '2099-01-01', STOP_TIME: '2099-01-02' });
  const earlyText = early.error + early.result;
  const lateText = late.error + late.result;
  const start = parseHorizonsDate(earlyText.match(/prior to A\.D\. ([^\n]*)/)?.[1] ?? '');
  if (!start) throw new Error(`Could not find the data start for ${id}: ${earlyText.slice(0, 300)}`);
  const endMatch = lateText.match(/after A\.D\. ([^\n]*)/);
  let end = Infinity;
  if (endMatch) end = parseHorizonsDate(endMatch[1]);
  else if (!lateText.includes('$$SOE')) throw new Error(`Could not find the data end for ${id}: ${lateText.slice(0, 300)}`);
  return { start, end };
}

/** Fetch vectors between two JDs with a step in hours. Returns {t: [JD], p: [x,y,z,...]}. */
async function vectors(id, startJd, stopJd, stepH) {
  const t = [];
  const p = [];
  const span = MAX_STEPS_PER_REQUEST * (stepH / 24);
  for (let a = startJd; a < stopJd; a += span) {
    const b = Math.min(stopJd, a + span);
    const step = stepH >= 24 && stepH % 24 === 0 ? `${stepH / 24}d` : `${Math.round(stepH * 60)}m`;
    const result = await horizons({
      COMMAND: id,
      EPHEM_TYPE: 'VECTORS',
      CENTER: '500@10',
      REF_PLANE: 'ECLIPTIC',
      REF_SYSTEM: 'ICRF',
      VEC_TABLE: '1',
      OUT_UNITS: 'AU-D',
      CSV_FORMAT: 'YES',
      OBJ_DATA: 'NO',
      START_TIME: `JD${a.toFixed(6)}`,
      STOP_TIME: `JD${b.toFixed(6)}`,
      STEP_SIZE: step,
    }).catch((err) => {
      throw new Error(`${err.message} (JD${a.toFixed(6)}–JD${b.toFixed(6)}, step ${step})`);
    });
    const body = result.split('$$SOE')[1]?.split('$$EOE')[0];
    if (!body) throw new Error(`No data for ${id} between JD${a} and JD${b}:\n${result.slice(0, 800)}`);
    for (const line of body.trim().split('\n')) {
      const f = line.split(',').map((s) => s.trim());
      const jd = Number(f[0]);
      if (t.length && jd <= t[t.length - 1]) continue;
      t.push(jd);
      p.push(Number(f[2]), Number(f[3]), Number(f[4]));
    }
  }
  return { t, p };
}

/** Windows (JD ranges) where the coarse sampling bends more than the tolerance. */
function bendWindows(c) {
  const wins = [];
  for (let i = 1; i < c.t.length - 1; i++) {
    let e = 0;
    for (let k = 0; k < 3; k++) {
      e = Math.max(e, Math.abs(c.p[(i - 1) * 3 + k] - 2 * c.p[i * 3 + k] + c.p[(i + 1) * 3 + k]));
    }
    // Chord error is about an eighth of the second difference.
    if (e / 8 > TOL_AU) {
      const a = c.t[i - 1];
      const b = c.t[i + 1];
      const last = wins[wins.length - 1];
      if (last && a <= last[1] + 10) last[1] = Math.max(last[1], b);
      else wins.push([a, b]);
    }
  }
  return wins;
}

function mergeSamples(coarse, fineParts) {
  const pts = [];
  const inFine = (jd) => fineParts.some((f) => jd > f.t[0] && jd < f.t[f.t.length - 1]);
  for (let i = 0; i < coarse.t.length; i++) {
    if (!inFine(coarse.t[i])) pts.push([coarse.t[i], coarse.p[i * 3], coarse.p[i * 3 + 1], coarse.p[i * 3 + 2]]);
  }
  for (const f of fineParts) {
    for (let i = 0; i < f.t.length; i++) pts.push([f.t[i], f.p[i * 3], f.p[i * 3 + 1], f.p[i * 3 + 2]]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const t = [];
  const p = [];
  for (const q of pts) {
    if (t.length && q[0] - t[t.length - 1] < 1e-6) continue;
    t.push(q[0]);
    p.push(q[1], q[2], q[3]);
  }
  return { t, p };
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

async function fetchProbe(probe) {
  const cov = await coverage(probe.horizons);
  const start = Math.ceil((cov.start + 1 / 1440) * 1440) / 1440; // next whole minute
  let end = Math.min(cov.end, LIMIT_END_JD);
  if (probe.end) end = Math.min(end, Date.parse(probe.end) / 86400000 + 2440587.5);
  end = Math.floor(end * 1440) / 1440;

  const coarse = await vectors(probe.horizons, start, end, COARSE_STEP_H);
  const tail = await vectors(probe.horizons, end - 5 / 1440, end, 1 / 60);
  const wins = bendWindows(coarse);
  const fine = [];
  for (const [a, b] of wins) fine.push(await vectors(probe.horizons, a, b, FINE_STEP_H));
  const merged = mergeSamples(coarse, [...fine, tail]);
  const thin = decimate(merged.t, merged.p, TOL_AU, 120);

  const finePoints = fine.reduce((s, f) => s + f.t.length, 0);
  console.log(
    `${probe.name}: ${coarse.t.length} coarse + ${finePoints} fine samples in ${wins.length} windows -> ${thin.t.length} points`,
  );

  return {
    id: probe.id,
    name: probe.name,
    horizonsId: probe.horizons,
    source: 'NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/)',
    frame: 'Heliocentric ecliptic J2000, AU. t = days since J2000 (TDB).',
    generated: new Date().toISOString().slice(0, 10),
    // Positions after this moment are predictions (planned trajectory).
    generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
    toleranceAU: TOL_AU,
    t: thin.t.map((jd) => round(jd - JD_J2000, 5)),
    p: thin.p.map((v) => round(v, 6)),
  };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const indexPath = join(OUT_DIR, 'index.json');
  const index = (await exists(indexPath)) ? JSON.parse(await readFile(indexPath, 'utf8')) : { probes: {} };

  let failures = 0;
  for (const probe of PROBES) {
    const file = join(OUT_DIR, `${probe.id}.json`);
    const wanted = only ? only.includes(probe.id) : all || probe.active || !(await exists(file));
    if (!wanted) continue;
    try {
      const data = await fetchProbe(probe);
      await writeFile(file, JSON.stringify(data) + '\n');
      index.probes[probe.id] = {
        file: `${probe.id}.json`,
        generated: data.generated,
        start: data.t[0],
        end: data.t[data.t.length - 1],
        points: data.t.length,
      };
    } catch (err) {
      failures++;
      console.error(`${probe.name}: FAILED – ${err.message}`);
    }
  }
  index.source = 'NASA/JPL Horizons';
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  if (failures) process.exitCode = 1;
}

main();
