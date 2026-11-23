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
// Times: days since J2000, in UT (Horizons' TDB times are converted), so they
// match the clock the page and Astronomy Engine use.
//
// Sampling is adaptive: a coarse pass finds where the path bends sharply
// (flybys, orbits, perihelia) and those windows are re-fetched hourly; close
// to a planet the path is re-fetched every 10 minutes. Two files per probe:
//   <id>.json         thinned to TOL_AU everywhere (loaded at start)
//   <id>.detail.json  also thinned to a few hundred km near planets (loaded on demand)
//
// The script also writes planets.json: Horizons minus Astronomy Engine for each
// planet, so the page can place the planets exactly where the probes expect them.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Astronomy from 'astronomy-engine';
import { PROBES } from '../src/probe-catalog.js';
import { PLANETS, AU_KM } from '../src/bodies.js';
import { PLANET_ORBITS } from '../src/scale.js';
import { helioEclipticRaw } from '../src/astro.js';
import { decimate, positionAt, daysToMs } from '../src/trajectory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data', 'probes');
const PLANETS_FILE = join(ROOT, 'public', 'data', 'planets.json');
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const JD_J2000 = 2451545.0;
const LIMIT_END_JD = 2470172.5; // 2051-01-01 – a little beyond the time slider's end
const TOL_AU = 2e-4; // ~30,000 km
const COARSE_STEP_H = 24;
const FINE_STEP_H = 1;
const NEAR_STEP_H = 1 / 6; // 10 minutes
const START_JD = 2440587.5 - 31; // 1969-12-01
// Horizons IDs for the planet corrections (Pluto: system barycentre, no Charon wobble).
// Mercury is left out: no probe here visits it, and its tiny residuals need many samples.
const PLANET_HORIZONS = { Venus: '299', Earth: '399', Mars: '499', Jupiter: '599', Saturn: '699', Uranus: '799', Neptune: '899', Pluto: '9' };
// "Near a planet": within 40 planet radii, at least 500,000 km.
const NEAR_AU = Object.fromEntries(PLANETS.map((p) => [p.id, Math.max(40 * p.radiusKm, 500000) / AU_KM]));
const NEAR_TOL_AU = Object.fromEntries(PLANETS.map((p) => [p.id, Math.max(0.05 * p.radiusKm, 300) / AU_KM]));
const AE_VERSION = JSON.parse(
  await readFile(join(ROOT, 'node_modules', 'astronomy-engine', 'package.json'), 'utf8'),
).version;
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
const nowIso = () => new Date().toISOString().slice(0, 19) + 'Z';

/** Horizons TDB Julian date -> UT days since J2000 (removes ΔT, about a minute). */
function jdToUtDays(jd) {
  const d = jd - JD_J2000;
  const at = Astronomy.MakeTime(new Date(daysToMs(d)));
  return d - (at.tt - at.ut);
}
const toUt = (s) => ({ t: s.t.map(jdToUtDays), p: s.p });

// ---------- Planet corrections ----------
let planetCorr = {};

function planetAt(name, utDays) {
  const e = helioEclipticRaw(name, new Date(daysToMs(utDays)));
  const v = [e.x, e.y, e.z];
  const c = planetCorr[name];
  if (c) {
    const d = positionAt({ t: c.t, p: c.d }, utDays);
    if (d) for (let k = 0; k < 3; k++) v[k] += d[k];
  }
  return v;
}

async function fetchPlanetCorrections() {
  const bodies = {};
  for (const planet of PLANETS) {
    const hid = PLANET_HORIZONS[planet.id];
    if (!hid) continue;
    const h = toUt(await vectors(hid, START_JD, LIMIT_END_JD + 31, 48));
    const d = [];
    for (let i = 0; i < h.t.length; i++) {
      const e = helioEclipticRaw(planet.id, new Date(daysToMs(h.t[i])));
      d.push(h.p[i * 3] - e.x, h.p[i * 3 + 1] - e.y, h.p[i * 3 + 2] - e.z);
    }
    const tol = Math.max(0.1 * planet.radiusKm, 500) / AU_KM;
    const thin = decimate(h.t, d, tol, 400);
    bodies[planet.id] = { t: thin.t.map((v) => round(v, 4)), d: thin.p.map((v) => round(v, 8)) };
    console.log(`${planet.name} correction: ${h.t.length} samples -> ${thin.t.length} points`);
  }
  planetCorr = bodies;
  await writeFile(
    PLANETS_FILE,
    JSON.stringify({
      source: 'NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/)',
      about: 'Horizons position minus Astronomy Engine position per planet (heliocentric ecliptic J2000, AU). t = days since J2000 (UT).',
      astronomyEngine: AE_VERSION,
      generatedAt: nowIso(),
      bodies,
    }) + '\n',
  );
}

/** For each sample: the planet it is near (or null). */
function nearPlanets(s) {
  const out = new Array(s.t.length).fill(null);
  for (let i = 0; i < s.t.length; i++) {
    const v = [s.p[i * 3], s.p[i * 3 + 1], s.p[i * 3 + 2]];
    const r = Math.hypot(...v);
    for (const name in PLANET_ORBITS) {
      const { a, e } = PLANET_ORBITS[name];
      if (Math.abs(r - a) > NEAR_AU[name] + a * e + 0.02) continue;
      const P = planetAt(name, s.t[i]);
      if (Math.hypot(v[0] - P[0], v[1] - P[1], v[2] - P[2]) < NEAR_AU[name]) {
        out[i] = name;
        break;
      }
    }
  }
  return out;
}

/** Time windows (UT days) around runs of samples that are near a planet. */
function nearWindows(s, near) {
  const wins = [];
  for (let i = 0; i < s.t.length; i++) {
    if (!near[i]) continue;
    const a = s.t[Math.max(0, i - 1)];
    const b = s.t[Math.min(s.t.length - 1, i + 1)];
    const last = wins[wins.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else wins.push([a, b]);
  }
  return wins;
}

const utToJd = (d) => d + JD_J2000; // close enough for choosing fetch windows

async function fetchProbe(probe) {
  const cov = await coverage(probe.horizons);
  const start = Math.ceil((cov.start + 1 / 1440) * 1440) / 1440; // next whole minute
  let end = Math.min(cov.end, LIMIT_END_JD);
  if (probe.end) end = Math.min(end, Date.parse(probe.end) / 86400000 + 2440587.5);
  end = Math.floor(end * 1440) / 1440;

  // 1. Daily samples, hourly where the path bends.
  const coarse = await vectors(probe.horizons, start, end, COARSE_STEP_H);
  const tail = await vectors(probe.horizons, end - 5 / 1440, end, 1 / 60);
  const wins = bendWindows(coarse);
  const fine = [];
  for (const [a, b] of wins) fine.push(await vectors(probe.horizons, a, b, FINE_STEP_H));
  const merged = toUt(mergeSamples(coarse, [...fine, tail]));

  // 2. Every 10 minutes close to planets.
  const near0 = nearPlanets(merged);
  const nearWins = nearWindows(merged, near0);
  const close = [];
  for (const [a, b] of nearWins) {
    const ja = Math.max(start, utToJd(a));
    const jb = Math.min(end, utToJd(b));
    if (jb - ja > 1 / 24) close.push(toUt(await vectors(probe.horizons, ja, jb, NEAR_STEP_H)));
  }
  const all = mergeSamples(merged, close);
  const near = nearPlanets(all);
  const visited = [...new Set(near.filter(Boolean))];

  // 3. Thin out: everywhere to TOL_AU, and a detailed version near planets.
  const base = decimate(all.t, all.p, TOL_AU, 120);
  const tol = near.map((n) => (n ? NEAR_TOL_AU[n] : TOL_AU));
  const detail = visited.length ? decimate(all.t, all.p, tol, 120) : null;

  const closeSamples = close.reduce((s, f) => s + f.t.length, 0);
  console.log(
    `${probe.name}: ${coarse.t.length} daily + ${fine.reduce((s, f) => s + f.t.length, 0)} hourly + ${closeSamples} ten-minute samples` +
      ` -> ${base.t.length} points${detail ? `, detail ${detail.t.length} points (near ${visited.join(', ')})` : ''}`,
  );

  const meta = {
    id: probe.id,
    name: probe.name,
    horizonsId: probe.horizons,
    source: 'NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/)',
    frame: 'Heliocentric ecliptic J2000, AU. t = days since J2000 (UT).',
    generated: new Date().toISOString().slice(0, 10),
    // Positions after this moment are predictions (planned trajectory).
    generatedAt: nowIso(),
  };
  const pack = (s, tolAU, digits) => ({
    ...meta,
    toleranceAU: tolAU,
    t: s.t.map((d) => round(d, 5)),
    p: s.p.map((v) => round(v, digits)),
  });
  return {
    base: pack(base, TOL_AU, 6),
    detail: detail ? pack(detail, 'varies: ~300 km to a few thousand km near planets, TOL_AU elsewhere', 7) : null,
    near: visited,
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
  try {
    await fetchPlanetCorrections();
  } catch (err) {
    failures++;
    console.error(`Planet corrections: FAILED – ${err.message}`);
    if (await exists(PLANETS_FILE)) planetCorr = JSON.parse(await readFile(PLANETS_FILE, 'utf8')).bodies;
  }
  for (const probe of PROBES) {
    const file = join(OUT_DIR, `${probe.id}.json`);
    const wanted = only ? only.includes(probe.id) : all || probe.active || !(await exists(file));
    if (!wanted) continue;
    try {
      const { base, detail, near } = await fetchProbe(probe);
      await writeFile(file, JSON.stringify(base) + '\n');
      const detailName = `${probe.id}.detail.json`;
      if (detail) await writeFile(join(OUT_DIR, detailName), JSON.stringify(detail) + '\n');
      index.probes[probe.id] = {
        file: `${probe.id}.json`,
        detail: detail ? detailName : null,
        near,
        generated: base.generated,
        start: base.t[0],
        end: base.t[base.t.length - 1],
        points: base.t.length,
        detailPoints: detail ? detail.t.length : 0,
      };
    } catch (err) {
      failures++;
      console.error(`${probe.name}: FAILED – ${err.message}`);
    }
  }
  index.source = 'NASA/JPL Horizons';
  index.planets = 'planets.json';
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  if (failures) process.exitCode = 1;
}

main();
