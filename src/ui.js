// Controls around the 3D view: time dock, probe and event lists, info panel.

import { PROBES } from './probe-catalog.js';
import { EVENTS } from './events.js';
import { orbitalPeriodDays } from './astro.js';
import { TIME_MIN, TIME_MAX, DAY_MS, SPEEDS } from './clock.js';
import { formatDate, isoDate, formatDistance, formatLightTime, formatSpeed, formatPeriod, formatKm } from './format.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export function setupUi({ app, clock }) {
  const dateInput = $('date');
  const timeline = $('timeline');
  const playBtn = $('play');
  const reverseBtn = $('reverse');
  const info = $('info');
  const sheet = $('sheet');
  const banner = $('banner');
  let infoId = null;
  let sheetKind = null;
  let lastDay = '';
  let bannerTimer = 0;
  let lastInfoHead = '';
  let lastInfoRows = '';

  // ---------- Hint ----------
  const hint = $('hint');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  hint.textContent = coarse
    ? 'Drag to rotate · Pinch to zoom · Two fingers to pan · Tap a planet or probe'
    : 'Drag to rotate · Scroll to zoom · Right-drag to pan · Click a planet or probe';
  const hideHint = () => hint.classList.add('is-hidden');
  $('app').addEventListener('pointerdown', hideHint, { once: true });
  setTimeout(hideHint, 15000);

  // ---------- Time controls ----------
  const totalDays = Math.floor((TIME_MAX - TIME_MIN) / DAY_MS);
  timeline.max = String(totalDays);
  dateInput.min = isoDate(TIME_MIN);
  dateInput.max = isoDate(TIME_MAX);

  function setTime(t) {
    clock.set(t);
    app.setTime(clock.t); // update positions now, before any camera move that depends on them
    refreshTime(true);
  }

  timeline.addEventListener('input', () => {
    const dayStart = TIME_MIN + Number(timeline.value) * DAY_MS;
    setTime(dayStart + (clock.t - Math.floor(clock.t / DAY_MS) * DAY_MS));
  });

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    const ms = Date.parse(`${dateInput.value}T00:00:00Z`);
    if (Number.isNaN(ms)) return;
    setTime(ms + (clock.t - Math.floor(clock.t / DAY_MS) * DAY_MS));
  });

  playBtn.addEventListener('click', () => {
    clock.playing = !clock.playing;
    if (clock.playing && (clock.t >= TIME_MAX && clock.dir > 0)) clock.t = TIME_MIN;
    if (clock.playing && (clock.t <= TIME_MIN && clock.dir < 0)) clock.t = TIME_MAX;
    refreshControls();
  });

  reverseBtn.addEventListener('click', () => {
    clock.dir = -clock.dir;
    refreshControls();
  });

  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => {
      clock.speed = b.dataset.speed;
      refreshControls();
    });
  }

  $('now').addEventListener('click', () => setTime(Date.now()));

  for (const b of document.querySelectorAll('[data-scale]')) {
    b.addEventListener('click', () => {
      app.setScale(b.dataset.scale);
      refreshControls();
    });
  }

  function refreshControls() {
    playBtn.classList.toggle('is-playing', clock.playing);
    playBtn.setAttribute('aria-label', clock.playing ? 'Pause' : 'Play');
    reverseBtn.setAttribute('aria-pressed', String(clock.dir < 0));
    for (const b of document.querySelectorAll('[data-speed]')) {
      b.setAttribute('aria-pressed', String(b.dataset.speed === clock.speed));
    }
    for (const b of document.querySelectorAll('[data-scale]')) {
      b.setAttribute('aria-pressed', String(b.dataset.scale === app.scale));
    }
  }

  /** Update the date field and the timeline when the day changes. */
  function refreshTime(force = false) {
    const day = isoDate(clock.t);
    if (!force && day === lastDay) return;
    lastDay = day;
    if (document.activeElement !== dateInput) dateInput.value = day;
    timeline.value = String(Math.floor((clock.t - TIME_MIN) / DAY_MS));
    if (!clock.playing) refreshControls();
  }

  // Event ticks on the timeline.
  const ticks = $('ticks');
  const now = Date.now();
  ticks.innerHTML = EVENTS.map((e) => {
    const pct = ((e.time - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;
    return `<span class="tick${e.time > now ? ' is-planned' : ''}" style="left:${pct.toFixed(2)}%"></span>`;
  }).join('');
  const nowPct = ((now - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;
  ticks.insertAdjacentHTML('beforeend', `<span class="tick-now" style="left:${nowPct.toFixed(2)}%"></span>`);

  // ---------- Sheets (probe list, event list) ----------
  function openSheet(kind) {
    hideHint();
    sheetKind = kind;
    $('sheet-title').textContent = kind === 'probes' ? 'Probes' : 'Events';
    $('sheet-body').innerHTML = kind === 'probes' ? probeListHtml() : eventListHtml();
    sheet.hidden = false;
    document.documentElement.classList.add('has-sheet');
    if (kind === 'events') {
      const next = $('sheet-body').querySelector('.is-next');
      next?.scrollIntoView({ block: 'center' });
    }
    sheet.querySelector('[data-close]')?.focus({ preventScroll: true });
  }

  function closeSheet() {
    sheet.hidden = true;
    sheetKind = null;
    document.documentElement.classList.remove('has-sheet');
  }

  $('open-probes').addEventListener('click', () => (sheetKind === 'probes' ? closeSheet() : openSheet('probes')));
  $('open-events').addEventListener('click', () => (sheetKind === 'events' ? closeSheet() : openSheet('events')));

  function probeListHtml() {
    return `<ul class="list">${PROBES.map((p) => {
      const launch = Date.parse(`${p.launch}T00:00:00Z`);
      const note = clock.t < launch ? 'Not launched yet' : `Launched ${p.launch.slice(0, 4)}`;
      return `<li><button type="button" class="list-item" data-probe="${p.id}">
        <span class="dot" style="background:${hex(p.color)}"></span>
        <span class="list-main">${esc(p.name)}</span>
        <span class="list-note">${note}</span></button></li>`;
    }).join('')}</ul>
    <p class="sheet-note">Trajectories: NASA/JPL Horizons.</p>`;
  }

  function eventListHtml() {
    const realNow = Date.now();
    let year = '';
    let nextMarked = false;
    const items = EVENTS.map((e, i) => {
      const y = new Date(e.time).getUTCFullYear();
      const head = String(y) !== year ? `<li class="list-year">${y}</li>` : '';
      year = String(y);
      let cls = 'list-item';
      if (!nextMarked && e.time >= clock.t) {
        cls += ' is-next';
        nextMarked = true;
      }
      const probe = PROBES.find((p) => p.id === e.probe);
      return `${head}<li><button type="button" class="${cls}" data-event="${i}">
        <span class="dot" style="background:${hex(probe.color)}"></span>
        <span class="list-main">${esc(e.title)}${e.time > realNow ? ' <span class="badge">Planned</span>' : ''}</span>
        <span class="list-note">${formatDate(e.time)}</span></button></li>`;
    }).join('');
    return `<ul class="list">${items}</ul>`;
  }

  $('sheet-body').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.dataset.probe) {
      app.follow(btn.dataset.probe);
      showInfo(btn.dataset.probe);
      closeSheet();
    } else if (btn.dataset.event) {
      jumpToEvent(EVENTS[Number(btn.dataset.event)]);
      closeSheet();
    }
  });

  function jumpToEvent(e) {
    clock.playing = false;
    setTime(e.time);
    app.follow(e.probe, e.view);
    showInfo(e.probe);
    showBanner(`${formatDate(e.time)} · ${e.title}`);
  }

  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner.hidden = true), 7000);
  }

  // ---------- Info panel ----------
  function showInfo(id) {
    hideHint();
    infoId = id;
    info.hidden = false;
    document.documentElement.classList.add('has-info');
    lastInfoHead = '';
    renderInfo();
    updateInset();
  }

  function closeInfo() {
    infoId = null;
    info.hidden = true;
    document.documentElement.classList.remove('has-info');
    updateInset();
  }

  // On phones the info panel covers the lower part of the view: tell the 3D view.
  const phone = window.matchMedia('(max-width: 640px)');
  function updateInset() {
    if (info.hidden || !phone.matches) {
      app.setBottomInset(0);
      return;
    }
    const rect = info.getBoundingClientRect();
    app.setBottomInset(window.innerHeight - rect.top);
  }
  new ResizeObserver(updateInset).observe(info);
  phone.addEventListener('change', updateInset);

  for (const b of document.querySelectorAll('[data-close]')) {
    b.addEventListener('click', () => (b.dataset.close === 'info' ? closeInfo() : closeSheet()));
  }

  info.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-follow]');
    if (btn) {
      app.follow(btn.dataset.follow);
      renderInfo();
    }
  });

  function row(label, value) {
    return value ? `<div class="row"><dt>${label}</dt><dd>${value}</dd></div>` : '';
  }

  function renderInfo() {
    if (!infoId) return;
    const i = app.getInfo(infoId);
    if (!i) return;
    const r = Math.hypot(...i.helio);
    const toEarth = i.earth && i.id !== 'Earth'
      ? Math.hypot(i.helio[0] - i.earth[0], i.helio[1] - i.earth[1], i.helio[2] - i.earth[2])
      : null;
    // The static part is only rebuilt when it changes, so buttons stay put while time runs.
    let head = '';
    let rows = '';
    if (i.kind === 'sun') {
      head = `<h2>Sun</h2><p class="sub">Our star</p><dl id="info-rows"></dl>`;
      rows = `${row('From Earth', toEarth != null ? formatDistance(toEarth) : '')}
        ${row('Radius', formatKm(i.data.radiusKm))}`;
    } else if (i.kind === 'planet') {
      head = `<h2>${esc(i.name)}</h2><p class="sub">${i.data.dwarf ? 'Dwarf planet' : 'Planet'}</p><dl id="info-rows"></dl>`;
      rows = `${row('From the Sun', formatDistance(r))}
        ${row('From Earth', toEarth != null ? formatDistance(toEarth) : '')}
        ${row('Orbital period', formatPeriod(orbitalPeriodDays(i.id)))}
        ${row('Radius', formatKm(i.data.radiusKm))}`;
    } else {
      const p = i.data;
      const launch = Date.parse(`${p.launch}T00:00:00Z`);
      let status = '';
      if (i.state === 'before') status = `Not launched yet – launches on ${formatDate(launch)}.`;
      else if (i.state === 'ended' && p.end) status = `The mission ended on ${formatDate(Date.parse(p.end))}.`;
      else if (i.state === 'ended') status = `No trajectory data after ${formatDate(i.dataEnd)}.`;
      else if (i.state === 'extrapolated') status = `Estimated position: straight-line continuation after ${formatDate(i.dataEnd)}.`;
      else if (i.predicted) status = `Planned trajectory – a prediction made on ${formatDate(i.generated)}.`;
      const flying = i.state === 'flying' || i.state === 'extrapolated';
      const following = app.followingId === i.id;
      rows = `${flying ? row('From the Sun', formatDistance(r)) : ''}
        ${flying && toEarth != null ? row('From Earth', formatDistance(toEarth)) : ''}
        ${flying && i.speedKmS != null ? row('Speed (vs. the Sun)', formatSpeed(i.speedKmS)) : ''}
        ${flying && toEarth != null ? row('Signal time to Earth', formatLightTime(toEarth)) : ''}`;
      head = `<h2><span class="dot" style="background:${hex(p.color)}"></span>${esc(p.name)}</h2>
        <p class="sub">${esc(p.agency)} · launched ${formatDate(launch)}</p>
        ${status ? `<p class="status">${status}</p>` : ''}
        <dl id="info-rows"></dl>
        <p class="summary">${esc(p.summary)}</p>
        <div class="info-actions">
          ${flying ? `<button type="button" class="btn small" data-follow="${p.id}" ${following ? 'aria-pressed="true"' : ''}>${following ? 'Following' : 'Follow'}</button>` : ''}
          <span class="source">Trajectory: NASA/JPL Horizons</span>
        </div>`;
    }
    if (head !== lastInfoHead) {
      lastInfoHead = head;
      lastInfoRows = '';
      $('info-body').innerHTML = head;
    }
    if (rows !== lastInfoRows) {
      lastInfoRows = rows;
      $('info-rows').innerHTML = rows;
    }
  }

  // ---------- Focus / overview ----------
  $('overview').addEventListener('click', () => {
    app.resetView();
    closeInfo();
  });

  function onFocusChange(s) {
    $('overview').hidden = s.id === 'Sun';
  }

  function onSelect(id) {
    showInfo(id);
  }

  // ---------- Keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!sheet.hidden) closeSheet();
      else if (!info.hidden) closeInfo();
      return;
    }
    const tag = e.target?.tagName;
    if (e.key === ' ' && tag !== 'INPUT' && tag !== 'BUTTON' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      playBtn.click();
    }
  });

  // ---------- Per-frame ----------
  let infoTimer = 0;
  function onFrame() {
    refreshTime();
    const now = performance.now();
    if (infoId && now - infoTimer > 250) {
      infoTimer = now;
      renderInfo();
    }
  }

  refreshControls();
  refreshTime(true);

  return { onFrame, onFocusChange, onSelect, refreshControls, speeds: SPEEDS };
}
