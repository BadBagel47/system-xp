// The 3D view: Sun, planets, probes, orbits, trails, stars, labels and camera.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { AU_KM, SUN, PLANETS, SATURN_RINGS } from './bodies.js';
import { helioEcliptic, eclipticToScene, orbitEcliptic, northPoleScene } from './astro.js';
import { toDisplay, localScale } from './scale.js';
import { positionAt, sampleIndex, velocityAt, msToDays, daysToMs } from './trajectory.js';

const DEFAULT_DISTANCE = { real: 14, compressed: 7 };
const DEFAULT_ELEVATION_DEG = 38;
const DEFAULT_AZIMUTH_DEG = -60;
const TAP_RADIUS_PX = 26;
const FOCUS_DURATION_MS = 1000;
const PROBE_MIN_PX = 3.4;

/**
 * Starts the 3D view in `container`.
 *  onFrame(dtSeconds) -> current simulation time (ms); called before every frame.
 *  onFatal(reason)    -> rendering cannot continue.
 *  onFocusChange(summary) -> the centred body changed.
 *  onSelect(id)       -> the user tapped a body.
 */
export function startApp({ container, time, onFrame, onFatal, onFocusChange, onSelect }) {
  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x02030a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'scene-canvas';
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000);

  // ---------- Controls (one finger rotates, pinch zooms, two fingers pan) ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.1;
  controls.screenSpacePanning = true;
  controls.maxDistance = 400;
  controls.minDistance = 0.00002;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // ---------- Light ----------
  scene.add(new THREE.PointLight(0xffffff, 2.2, 0, 0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22)); // night sides stay faintly visible

  const stars = makeStars();
  scene.add(stars);

  // ---------- State ----------
  let mode = 'real';
  let simMs = time;
  let simDays = msToDays(simMs);
  const bodies = [];
  const byId = new Map();
  const planetHelio = {}; // current heliocentric positions (AU, ecliptic) by planet id

  // ---------- Sun ----------
  const sphereGeo = new THREE.SphereGeometry(1, 96, 64);
  const sunMesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: SUN.color }));
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffc46b,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.setScalar(5);
  sunMesh.add(glow);
  scene.add(sunMesh);
  addEntry({ kind: 'sun', id: 'Sun', name: SUN.name, label: SUN.name, info: SUN, mesh: sunMesh, priority: 0, minPx: SUN.minPx });

  // ---------- Planets ----------
  const startDate = new Date(simMs);
  for (const p of PLANETS) {
    const mesh = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9, metalness: 0 }),
    );
    if (p.rings) addSaturnRings(mesh, startDate);
    scene.add(mesh);
    const orbit = makeOrbit(p, startDate);
    scene.add(orbit.line);
    addEntry({ kind: 'planet', id: p.id, name: p.name, label: p.name, info: p, mesh, orbit, priority: p.priority, minPx: p.minPx });
  }

  // ---------- Probes ----------
  const probeGeo = new THREE.OctahedronGeometry(1, 0);
  const dashMaterials = [];

  function addProbes(list) {
    for (const { probe, traj } of list) {
      if (byId.has(probe.id)) continue;
      const mesh = new THREE.Mesh(probeGeo, new THREE.MeshBasicMaterial({ color: probe.color }));
      scene.add(mesh);
      const solid = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: probe.color, transparent: true, opacity: 0.75 }),
      );
      const dashMat = new THREE.LineDashedMaterial({
        color: probe.color,
        transparent: true,
        opacity: 0.6,
        dashSize: 0.1,
        gapSize: 0.08,
      });
      dashMaterials.push(dashMat);
      const planned = new THREE.Line(new THREE.BufferGeometry(), dashMat);
      const headGeo = new THREE.BufferGeometry();
      headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      headGeo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1));
      const head = new THREE.Line(headGeo, dashMat);
      for (const l of [solid, planned, head]) {
        l.frustumCulled = false;
        scene.add(l);
      }
      const entry = addEntry({
        kind: 'probe',
        id: probe.id,
        name: probe.name,
        label: probe.short || probe.name,
        info: probe,
        mesh,
        priority: 20,
        minPx: PROBE_MIN_PX,
      });
      entry.lines = { solid, planned, head, headGeo };
      entry.state = 'before';
      setTraj(entry, traj);
    }
    setTime(simMs, true);
  }

  /** Give a probe a (new) trajectory, e.g. the detailed version near planets. */
  function setTraj(entry, traj) {
    const n = traj.t.length;
    entry.traj = traj;
    entry.generatedDays = msToDays(Date.parse(traj.generated));
    entry.genIndex = sampleIndex(traj.t, entry.generatedDays);
    entry.display = {}; // cached display coordinates per scale mode
    const posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const distAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    const { solid, planned } = entry.lines;
    solid.geometry.dispose();
    planned.geometry.dispose();
    solid.geometry = new THREE.BufferGeometry();
    solid.geometry.setAttribute('position', posAttr);
    planned.geometry = new THREE.BufferGeometry();
    planned.geometry.setAttribute('position', posAttr);
    planned.geometry.setAttribute('lineDistance', distAttr);
    entry.lines.posAttr = posAttr;
    entry.lines.distAttr = distAttr;
    updateTrailGeometry(entry);
  }

  function upgradeProbe(id, traj) {
    const entry = byId.get(id);
    if (!entry || entry.kind !== 'probe') return;
    setTraj(entry, traj);
    setTime(simMs, true);
  }

  /** Recompute everything that depends on planet positions (after corrections load). */
  function refreshPlanets() {
    for (const b of bodies) if (b.traj) b.display.compressed = null;
    for (const b of bodies) if (b.traj && mode === 'compressed') updateTrailGeometry(b);
    setTime(simMs, true);
  }

  function addEntry(e) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `label label-${e.kind}`;
    el.textContent = e.label;
    if (e.kind === 'probe') el.style.setProperty('--probe-color', `#${e.info.color.toString(16).padStart(6, '0')}`);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      select(entry);
    });
    const label = new CSS2DObject(el);
    label.center.set(-0.12, 0.5);
    scene.add(label);
    const entry = {
      ...e,
      el,
      labelObj: label,
      radiusAU: (e.info.radiusKm || 0.001) / AU_KM,
      helio: [0, 0, 0],
      position: new THREE.Vector3(),
      screen: new THREE.Vector2(),
      pxRadius: 0,
      visible: true,
      onScreen: false,
    };
    bodies.push(entry);
    byId.set(e.id, entry);
    return entry;
  }

  // ---------- Scale ----------
  function planetLookupAt(ms) {
    const date = new Date(ms);
    const cache = {};
    return (name) => {
      if (!(name in cache)) {
        const e = helioEcliptic(name, date);
        cache[name] = [e.x, e.y, e.z];
      }
      return cache[name];
    };
  }

  function updateTrailGeometry(entry) {
    let pts = entry.display[mode];
    if (!pts) {
      const { t, p } = entry.traj;
      const n = t.length;
      pts = { pos: new Float32Array(n * 3), dist: new Float32Array(n) };
      const v = [0, 0, 0];
      const out = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        v[0] = p[i * 3];
        v[1] = p[i * 3 + 1];
        v[2] = p[i * 3 + 2];
        toDisplay(mode, v, mode === 'compressed' ? planetLookupAt(daysToMs(t[i])) : null, out);
        pts.pos.set(eclipticToScene({ x: out[0], y: out[1], z: out[2] }), i * 3);
        if (i > 0) {
          const dx = pts.pos[i * 3] - pts.pos[i * 3 - 3];
          const dy = pts.pos[i * 3 + 1] - pts.pos[i * 3 - 2];
          const dz = pts.pos[i * 3 + 2] - pts.pos[i * 3 - 1];
          pts.dist[i] = pts.dist[i - 1] + Math.hypot(dx, dy, dz);
        }
      }
      entry.display[mode] = pts;
    }
    entry.lines.posAttr.array.set(pts.pos);
    entry.lines.posAttr.needsUpdate = true;
    entry.lines.distAttr.array.set(pts.dist);
    entry.lines.distAttr.needsUpdate = true;
    entry.lines.solid.geometry.computeBoundingSphere();
  }

  function updateOrbitGeometry(entry) {
    const o = entry.orbit;
    if (!o.cache[mode]) {
      const arr = new Float32Array(o.ecliptic.length * 3);
      const out = [0, 0, 0];
      o.ecliptic.forEach((v, i) => {
        toDisplay(mode, v, null, out);
        arr.set(eclipticToScene({ x: out[0], y: out[1], z: out[2] }), i * 3);
      });
      o.cache[mode] = arr;
    }
    o.line.geometry.attributes.position.array.set(o.cache[mode]);
    o.line.geometry.attributes.position.needsUpdate = true;
    o.line.geometry.computeBoundingSphere();
  }

  /** How much the current scale enlarges space around an entry. */
  function kFor(entry, m = mode) {
    if (entry.kind === 'sun') return DEFAULT_DISTANCE[m] / DEFAULT_DISTANCE.real;
    return localScale(m, Math.hypot(...entry.helio));
  }

  function setScale(newMode) {
    if (newMode === mode) return;
    const oldK = kFor(focused);
    const offset = camera.position.clone().sub(controls.target);
    mode = newMode;
    for (const b of bodies) {
      if (b.orbit) updateOrbitGeometry(b);
      if (b.traj) updateTrailGeometry(b);
    }
    setTime(simMs, true);
    offset.multiplyScalar(kFor(focused) / oldK);
    focusAnim.active = false;
    controls.target.copy(focused.position);
    camera.position.copy(focused.position).add(offset);
    controls.update();
  }

  // ---------- Time ----------
  const tmpV = [0, 0, 0];
  const tmpOut = [0, 0, 0];

  function setTime(ms, force = false) {
    if (!force && ms === simMs) return;
    simMs = ms;
    simDays = msToDays(ms);
    const date = new Date(ms);
    for (const b of bodies) {
      if (b.kind === 'planet') {
        const e = helioEcliptic(b.id, date);
        b.helio[0] = e.x;
        b.helio[1] = e.y;
        b.helio[2] = e.z;
        planetHelio[b.id] = b.helio;
      }
    }
    const lookup = (name) => planetHelio[name];
    for (const b of bodies) {
      if (b.kind === 'sun') {
        b.position.set(0, 0, 0);
      } else if (b.kind === 'planet') {
        toDisplay(mode, b.helio, null, tmpOut);
        b.position.fromArray(eclipticToScene({ x: tmpOut[0], y: tmpOut[1], z: tmpOut[2] }));
      } else {
        updateProbe(b, lookup);
      }
      b.mesh.position.copy(b.position);
    }
  }

  function updateProbe(b, lookup) {
    const { t } = b.traj;
    const n = t.length;
    const extrapolate = b.info.afterData === 'extrapolate';
    const { solid, planned, head, headGeo } = b.lines;
    const pts = b.display[mode];

    if (simDays < t[0]) {
      b.state = 'before';
      b.visible = false;
      solid.visible = planned.visible = head.visible = false;
      return;
    }
    const pos = positionAt(b.traj, simDays, tmpV, extrapolate);
    const idx = Math.min(sampleIndex(t, simDays), n - 1);
    const gen = b.genIndex;

    // Trail up to the last sample before the current time; the part after the
    // data was generated is a prediction and is drawn dashed.
    const solidEnd = Math.min(idx, gen);
    solid.geometry.setDrawRange(0, solidEnd + 1);
    solid.visible = solidEnd >= 1;
    if (idx > gen) {
      planned.geometry.setDrawRange(gen, idx - gen + 1);
      planned.visible = true;
    } else {
      planned.visible = false;
    }

    if (!pos) {
      // After the end of the data for a probe that is not extrapolated.
      b.state = 'ended';
      b.visible = false;
      head.visible = false;
      return;
    }
    b.state = simDays > t[n - 1] ? 'extrapolated' : 'flying';
    b.visible = true;
    b.helio[0] = pos[0];
    b.helio[1] = pos[1];
    b.helio[2] = pos[2];
    toDisplay(mode, pos, mode === 'compressed' ? lookup : null, tmpOut);
    b.position.fromArray(eclipticToScene({ x: tmpOut[0], y: tmpOut[1], z: tmpOut[2] }));

    // Short segment from the last sample to the current position.
    const ha = headGeo.attributes.position.array;
    ha[0] = pts.pos[idx * 3];
    ha[1] = pts.pos[idx * 3 + 1];
    ha[2] = pts.pos[idx * 3 + 2];
    ha[3] = b.position.x;
    ha[4] = b.position.y;
    ha[5] = b.position.z;
    headGeo.attributes.position.needsUpdate = true;
    const hd = headGeo.attributes.lineDistance.array;
    hd[0] = pts.dist[idx];
    hd[1] = pts.dist[idx] + Math.hypot(ha[3] - ha[0], ha[4] - ha[1], ha[5] - ha[2]);
    headGeo.attributes.lineDistance.needsUpdate = true;
    const predicted = simDays > b.generatedDays || b.state === 'extrapolated';
    head.material = predicted ? planned.material : solid.material;
    head.visible = true;
  }

  // ---------- Camera / focus ----------
  let focused = byId.get('Sun');
  let following = false;
  const focusAnim = { active: false, from: new THREE.Vector3(), fromDist: 0, toDist: 0, start: 0 };

  function defaultDistance() {
    const aspect = camera.aspect || 1;
    return DEFAULT_DISTANCE[mode] * (aspect < 1 ? Math.sqrt(1 / aspect) : 1);
  }

  function setDefaultView() {
    const el = THREE.MathUtils.degToRad(DEFAULT_ELEVATION_DEG);
    const az = THREE.MathUtils.degToRad(DEFAULT_AZIMUTH_DEG);
    const d = defaultDistance();
    controls.target.set(0, 0, 0);
    camera.position.set(d * Math.cos(el) * Math.cos(az), d * Math.sin(el), -d * Math.cos(el) * Math.sin(az));
    camera.up.set(0, 1, 0);
    controls.update();
  }

  function summary(entry) {
    return { id: entry.id, kind: entry.kind, name: entry.name, following };
  }

  /** Centre the camera on an entry; `distanceAU` (optional) zooms to that distance (real-scale AU). */
  function focusOn(entry, distanceAU) {
    if (!entry) return;
    focused = entry;
    focusAnim.active = true;
    focusAnim.from.copy(controls.target);
    focusAnim.fromDist = camera.position.distanceTo(controls.target);
    focusAnim.toDist = distanceAU ? distanceAU * kFor(entry) : focusAnim.fromDist;
    focusAnim.start = performance.now();
    onFocusChange?.(summary(entry));
  }

  function select(entry) {
    following = false;
    focusOn(entry);
    onSelect?.(entry.id);
  }

  function follow(id, distanceAU) {
    const entry = byId.get(id);
    if (!entry) return;
    following = entry.kind === 'probe';
    focusOn(entry, distanceAU ?? followDistance(entry));
  }

  function followDistance(entry) {
    // Close enough to see the trail bend, further out for probes far from the Sun.
    const r = Math.hypot(...entry.helio);
    return Math.min(8, Math.max(0.25, r * 0.12));
  }

  function resetView() {
    focused = byId.get('Sun');
    following = false;
    focusAnim.active = false;
    setDefaultView();
    onFocusChange?.(summary(focused));
  }

  // Tap/click on (or near) a body selects it.
  const down = { x: 0, y: 0, t: 0, id: null };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    down.x = e.clientX;
    down.y = e.clientY;
    down.t = performance.now();
    down.id = e.pointerId;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 8 || performance.now() - down.t > 500) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best = null;
    let bestDist = TAP_RADIUS_PX;
    for (const b of bodies) {
      if (!b.onScreen || !b.visible) continue;
      const dist = Math.hypot(b.screen.x - x, b.screen.y - y) - Math.min(b.pxRadius, 200);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    if (best) select(best);
  });

  // ---------- Resize ----------
  let width = 1;
  let height = 1;
  let insetBottom = 0;
  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    applyViewOffset();
  }

  // Shift the picture up when a panel covers the bottom of the screen, so the
  // centred body stays visible above it.
  function applyViewOffset() {
    const shift = Math.round(Math.min(insetBottom, height * 0.6) / 2);
    if (shift > 0) camera.setViewOffset(width, height, 0, shift, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function setBottomInset(px) {
    insetBottom = Math.max(0, px);
    applyViewOffset();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  setTime(simMs, true);
  for (const b of bodies) if (b.orbit) updateOrbitGeometry(b);
  setDefaultView();

  // ---------- Context loss ----------
  let lost = false;
  let lostTimer = 0;
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    document.getElementById('paused')?.removeAttribute('hidden');
    lostTimer = window.setTimeout(() => {
      if (lost) onFatal?.('The 3D graphics context was lost and did not come back.');
    }, 5000);
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false;
    window.clearTimeout(lostTimer);
    document.getElementById('paused')?.setAttribute('hidden', '');
  });

  // ---------- Per-frame updates ----------
  const projected = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const delta = new THREE.Vector3();

  function updateFocus(now) {
    if (focusAnim.active) {
      const t = Math.min(1, (now - focusAnim.start) / FOCUS_DURATION_MS);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      tmp.copy(focusAnim.from).lerp(focused.position, k);
      delta.copy(tmp).sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
      if (focusAnim.toDist !== focusAnim.fromDist) {
        const d = Math.exp(Math.log(focusAnim.fromDist) + (Math.log(focusAnim.toDist) - Math.log(focusAnim.fromDist)) * k);
        const dir = tmp.copy(camera.position).sub(controls.target).normalize();
        camera.position.copy(controls.target).addScaledVector(dir, d);
      }
      if (t >= 1) focusAnim.active = false;
    } else if (!controls.target.equals(focused.position)) {
      // Keep following the centred body as time runs.
      delta.copy(focused.position).sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
    }
  }

  function updateSizesAndLabels() {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const placed = [];
    const order = [...bodies].sort((a, b) => (a === focused ? -1 : b === focused ? 1 : a.priority - b.priority));
    for (const b of order) {
      b.mesh.visible = b.visible;
      if (!b.visible) {
        b.labelObj.visible = false;
        b.onScreen = false;
        continue;
      }
      const dist = camera.position.distanceTo(b.position);
      const worldPerPx = (2 * dist * tanHalf) / height;
      const k = b.kind === 'sun' ? 1 : kFor(b);
      const r = Math.max(b.radiusAU * k, b.minPx * worldPerPx);
      b.mesh.scale.setScalar(r);
      b.pxRadius = r / worldPerPx;

      projected.copy(b.position).project(camera);
      b.onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      b.screen.set((projected.x + 1) * 0.5 * width, (1 - projected.y) * 0.5 * height);

      b.labelObj.position.copy(b.position);
      b.el.style.marginLeft = `${Math.min(b.pxRadius, 60)}px`;
      const box = {
        x0: b.screen.x + b.pxRadius,
        x1: b.screen.x + b.pxRadius + 8 + b.label.length * 7,
        y0: b.screen.y - 9,
        y1: b.screen.y + 9,
      };
      const overlaps = placed.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0);
      const show = b.onScreen && !overlaps && b.pxRadius < 80;
      b.labelObj.visible = show;
      if (show) placed.push(box);
      b.el.classList.toggle('is-focused', b === focused);
      if (b.lines) {
        const strong = b === focused;
        b.lines.solid.material.opacity = strong ? 0.95 : 0.45;
        b.lines.planned.material.opacity = strong ? 0.85 : 0.4;
      }
    }
    controls.minDistance = Math.max(focused.radiusAU * kFor(focused) * 2.5, 0.00002);
  }

  function updateClipping() {
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(d * 0.0005, 1e-7);
    camera.far = d + 600;
    camera.updateProjectionMatrix();
    stars.position.copy(camera.position);
    for (const m of dashMaterials) {
      m.dashSize = d * 0.012;
      m.gapSize = d * 0.009;
    }
  }

  let firstFrame = true;
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    if (lost) return;
    try {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (onFrame) setTime(onFrame(dt));
      updateFocus(now);
      controls.update();
      updateClipping();
      updateSizesAndLabels();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      if (firstFrame) {
        firstFrame = false;
        document.getElementById('loading')?.setAttribute('hidden', '');
      }
    } catch (err) {
      renderer.setAnimationLoop(null);
      onFatal?.(`Rendering failed: ${err?.message || err}`);
    }
  });

  // ---------- Info for the UI ----------
  function getInfo(id) {
    const b = byId.get(id);
    if (!b) return null;
    const earth = planetHelio.Earth;
    const info = {
      id: b.id,
      kind: b.kind,
      name: b.name,
      data: b.info,
      state: b.kind === 'probe' ? b.state : 'flying',
      helio: b.kind === 'sun' ? [0, 0, 0] : [...b.helio],
      earth: earth ? [...earth] : null,
      speedKmS: null,
      predicted: false,
    };
    if (b.kind === 'probe') {
      info.dataStart = daysToMs(b.traj.t[0]);
      info.dataEnd = daysToMs(b.traj.t[b.traj.t.length - 1]);
      info.generated = daysToMs(b.generatedDays);
      info.predicted = simDays > b.generatedDays;
      if (b.state === 'flying' || b.state === 'extrapolated') {
        const v = velocityAt(b.traj, Math.min(simDays, b.traj.t[b.traj.t.length - 1]));
        info.speedKmS = (Math.hypot(v[0], v[1], v[2]) * AU_KM) / 86400;
      }
    }
    return info;
  }

  return {
    setTime: (ms) => setTime(ms),
    setScale,
    get scale() {
      return mode;
    },
    resetView,
    follow,
    select: (id) => byId.get(id) && select(byId.get(id)),
    addProbes,
    upgradeProbe,
    refreshPlanets,
    getInfo,
    setBottomInset,
    get focusedId() {
      return focused.id;
    },
    get followingId() {
      return following ? focused.id : null;
    },
  };
}

// ---------- Helpers ----------

function makeOrbit(planet, date) {
  const ecliptic = orbitEcliptic(planet.id, date, 512);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ecliptic.length * 3), 3));
  const mat = new THREE.LineBasicMaterial({
    color: planet.color,
    transparent: true,
    opacity: planet.dwarf ? 0.22 : 0.38,
  });
  return { line: new THREE.LineLoop(geo, mat), ecliptic, cache: {} };
}

function addSaturnRings(mesh, date) {
  const group = new THREE.Group();
  for (const r of SATURN_RINGS) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r.inner, r.outer, 128, 1),
      new THREE.MeshBasicMaterial({
        color: 0xe8d9b0,
        transparent: true,
        opacity: r.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    group.add(ring);
  }
  // RingGeometry lies in the XY plane (normal +Z); turn it to face Saturn's pole.
  const pole = new THREE.Vector3().fromArray(northPoleScene('Saturn', date)).normalize();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pole);
  mesh.add(group);
}

function makeStars() {
  const count = 4000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const rand = mulberry32(47);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 300;
    pos[i * 3] = r * s * Math.cos(phi);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(phi);
    const brightness = 0.25 + Math.pow(rand(), 3) * 0.75;
    c.setHSL(0.55 + (rand() - 0.5) * 0.25, 0.25 * rand(), brightness);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: false,
    depthTest: false,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = -1;
  points.frustumCulled = false;
  return points;
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.2, 'rgba(255,200,110,0.55)');
  g.addColorStop(0.5, 'rgba(255,160,60,0.12)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
