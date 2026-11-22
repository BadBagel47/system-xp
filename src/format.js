// Formatting helpers for dates, distances and speeds (English, metric).

import { AU_KM } from './bodies.js';

const LIGHT_KM_S = 299792.458;

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const intFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

export const formatDate = (ms) => dateFmt.format(new Date(ms));
export const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

function sig(v, digits = 3) {
  return Number(v.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 3 });
}

/** "5.20 AU · 778 million km" or "345,000 km" for short distances. */
export function formatDistance(au) {
  const km = au * AU_KM;
  if (au < 0.01) return `${intFmt.format(Math.round(km / 1000) * 1000)} km`;
  const kmText = km >= 1e9 ? `${sig(km / 1e9)} billion km` : `${sig(km / 1e6)} million km`;
  return `${au < 10 ? au.toFixed(2) : au.toFixed(1)} AU · ${kmText}`;
}

/** How long a radio signal (light) takes to travel the distance. */
export function formatLightTime(au) {
  const s = (au * AU_KM) / LIGHT_KM_S;
  if (s < 60) return `${s.toFixed(1)} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export const formatSpeed = (kmS) => `${kmS.toFixed(1)} km/s`;

export function formatPeriod(days) {
  return days < 700 ? `${intFmt.format(days)} days` : `${(days / 365.25).toFixed(1)} years`;
}

export const formatKm = (km) => `${intFmt.format(km)} km`;
