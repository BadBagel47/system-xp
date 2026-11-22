// The 3D view: Sun, planets, orbits, stars, labels and camera controls.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { AU_KM, SUN, PLANETS, SATURN_RINGS } from './bodies.js';
import { scenePosition, orbitPoints, northPoleScene } from './astro.js';

const DEFAULT_VIEW = { distance: 14, elevationDeg: 38, azimuthDeg: -60 };
const TAP_RADIUS_PX = 28;
const FOCUS_DURATION_MS = 900;

/**
 * Starts the 3D view in `container`.
 * `onFatal(reason)` is called if rendering cannot continue.
 */
export function startApp({ container, date, onFatal, onFocusChange }) {
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
  controls.maxDistance = 250;
  controls.minDistance = 0.0005;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // ---------- Light ----------
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 0);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  // ---------- Stars (drawn behind everything, follow the camera) ----------
  const stars = makeStars();
  scene.add(stars);

  // ---------- Bodies ----------
  const bodies = [];
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
  bodies.push(makeBodyEntry(SUN, sunMesh, 0));

  for (const p of PLANETS) {
    const mesh = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9, metalness: 0 }),
    );
    if (p.rings) addSaturnRings(mesh, date);
    scene.add(mesh);
    scene.add(makeOrbitLine(p, date));
    bodies.push(makeBodyEntry(p, mesh, p.priority));
  }

  function makeBodyEntry(info, mesh, priority) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'label';
    el.textContent = info.name;
    if (info.dwarf) el.title = `${info.name} (dwarf planet)`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      focusOn(entry);
    });
    const label = new CSS2DObject(el);
    label.center.set(-0.12, 0.5); // label sits to the right of the body
    scene.add(label);
    const entry = {
      info,
      mesh,
      label,
      el,
      priority,
      radiusAU: info.radiusKm / AU_KM,
      position: new THREE.Vector3(),
      screen: new THREE.Vector2(),
      onScreen: false,
    };
    return entry;
  }

  // ---------- Positions ----------
  function setDate(d) {
    for (const b of bodies) {
      if (b.info.id === 'Sun') b.position.set(0, 0, 0);
      else b.position.fromArray(scenePosition(b.info.id, d));
      b.mesh.position.copy(b.position);
    }
  }
  setDate(date);

  // ---------- Camera / focus ----------
  let focused = bodies[0];
  const focusAnim = { active: false, from: new THREE.Vector3(), start: 0 };
  const tmp = new THREE.Vector3();

  function setDefaultView() {
    const el = THREE.MathUtils.degToRad(DEFAULT_VIEW.elevationDeg);
    const az = THREE.MathUtils.degToRad(DEFAULT_VIEW.azimuthDeg);
    const d = DEFAULT_VIEW.distance;
    controls.target.set(0, 0, 0);
    camera.position.set(
      d * Math.cos(el) * Math.cos(az),
      d * Math.sin(el),
      -d * Math.cos(el) * Math.sin(az),
    );
    camera.up.set(0, 1, 0);
    controls.update();
  }
  setDefaultView();

  function focusOn(entry) {
    focused = entry;
    focusAnim.active = true;
    focusAnim.from.copy(controls.target);
    focusAnim.start = performance.now();
    onFocusChange?.(entry.info);
  }

  function resetView() {
    focused = bodies[0];
    focusAnim.active = false;
    setDefaultView();
    onFocusChange?.(focused.info);
  }

  // Tap/click on (or near) a body focuses it.
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
      if (!b.onScreen) continue;
      const dist = Math.hypot(b.screen.x - x, b.screen.y - y) - b.pxRadius;
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    if (best) focusOn(best);
  });

  // ---------- Resize ----------
  let width = 1;
  let height = 1;
  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

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

  function updateFocus(now) {
    if (focusAnim.active) {
      const t = Math.min(1, (now - focusAnim.start) / FOCUS_DURATION_MS);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const newTarget = tmp.copy(focusAnim.from).lerp(focused.position, k);
      const delta = newTarget.clone().sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
      if (t >= 1) focusAnim.active = false;
    } else if (!controls.target.equals(focused.position)) {
      // Keep following the focused body (it will move once time can change).
      const delta = tmp.copy(focused.position).sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
    }
  }

  function updateSizesAndLabels() {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const placed = [];
    const order = [...bodies].sort(
      (a, b) => (a === focused ? -1 : b === focused ? 1 : a.priority - b.priority),
    );
    for (const b of order) {
      const dist = camera.position.distanceTo(b.position);
      const worldPerPx = (2 * dist * tanHalf) / height;
      const r = Math.max(b.radiusAU, b.info.minPx * worldPerPx);
      b.mesh.scale.setScalar(r);
      b.pxRadius = r / worldPerPx;

      projected.copy(b.position).project(camera);
      b.onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      b.screen.set((projected.x + 1) * 0.5 * width, (1 - projected.y) * 0.5 * height);

      // Place the label just beside the drawn sphere and hide it if it would overlap another.
      b.label.position.copy(b.position);
      b.label.element.style.marginLeft = `${Math.min(b.pxRadius, 60)}px`;
      const box = {
        x0: b.screen.x + b.pxRadius,
        x1: b.screen.x + b.pxRadius + 8 + b.info.name.length * 7.5,
        y0: b.screen.y - 10,
        y1: b.screen.y + 10,
      };
      const overlaps = placed.some(
        (o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0,
      );
      // A body that fills much of the screen needs no label.
      const show = b.onScreen && !overlaps && b.pxRadius < 80;
      b.label.visible = show;
      if (show) placed.push(box);
      b.el.classList.toggle('is-focused', b === focused);
    }
    controls.minDistance = Math.max(focused.radiusAU * 2.5, 0.00002);
  }

  function updateClipping() {
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(d * 0.0005, 1e-7);
    camera.far = d + 400;
    camera.updateProjectionMatrix();
    stars.position.copy(camera.position);
  }

  let firstFrame = true;
  renderer.setAnimationLoop((now) => {
    if (lost) return;
    try {
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

  return { setDate, resetView, focusOn: (id) => focusOn(bodies.find((b) => b.info.id === id)) };
}

// ---------- Helpers ----------

function makeOrbitLine(planet, date) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(orbitPoints(planet.id, date, 512), 3));
  const mat = new THREE.LineBasicMaterial({
    color: planet.color,
    transparent: true,
    opacity: planet.dwarf ? 0.22 : 0.38,
  });
  return new THREE.LineLoop(geo, mat);
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
