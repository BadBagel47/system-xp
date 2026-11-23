import './style.css';
import { webglProblem, showFatal } from './webgl.js';
import { createClock } from './clock.js';

async function boot() {
  const problem = webglProblem();
  if (problem) {
    showFatal(problem);
    return;
  }

  const clock = createClock(Date.now());
  let app;
  let ui;
  let onFocus = () => {};
  try {
    const [{ startApp }, { setupUi }] = await Promise.all([import('./app.js'), import('./ui.js')]);
    app = startApp({
      container: document.getElementById('app'),
      time: clock.t,
      onFrame: (dt) => {
        const t = clock.tick(dt);
        ui?.onFrame();
        return t;
      },
      onFatal: showFatal,
      onFocusChange: (s) => {
        ui?.onFocusChange(s);
        onFocus(s);
      },
      onSelect: (id) => ui?.onSelect(id),
    });
    ui = setupUi({ app, clock });
  } catch (err) {
    showFatal(`Starting the 3D view failed: ${err?.message || err}`);
    return;
  }
  window.__systemXp = { app, clock };
  document.documentElement.dataset.started = 'true';

  // Data is loaded after the planets are on screen.
  try {
    const [{ loadProbeIndex, loadProbeData, loadPlanetCorrections, loadDetail }, { setPlanetCorrections }] =
      await Promise.all([import('./probes.js'), import('./astro.js')]);
    const index = await loadProbeIndex();
    const [corrections, list] = await Promise.all([loadPlanetCorrections(index), loadProbeData(index)]);
    if (corrections) {
      setPlanetCorrections(corrections);
      app.refreshPlanets();
    }
    app.addProbes(list);
    document.documentElement.dataset.probes = String(list.length);

    // Detailed trajectories (close to planets) are loaded when they are needed:
    // when a probe is centred, or a planet that probes have passed close to.
    const detailState = new Map(); // id -> 'loading' | 'done'
    const upgrade = async (item) => {
      if (!item.detail || detailState.has(item.probe.id)) return;
      detailState.set(item.probe.id, 'loading');
      try {
        app.upgradeProbe(item.probe.id, await loadDetail(item.detail));
        detailState.set(item.probe.id, 'done');
      } catch (err) {
        console.warn(`Detailed data for ${item.probe.name} could not be loaded:`, err);
        detailState.delete(item.probe.id);
      }
    };
    onFocus = (s) => {
      for (const item of list) {
        if (item.probe.id === s.id || (s.kind === 'planet' && item.near.includes(s.id))) upgrade(item);
      }
    };
    onFocus({ id: app.focusedId, kind: 'sun' });
  } catch (err) {
    console.warn('Probe data could not be loaded:', err);
    const banner = document.getElementById('banner');
    banner.textContent = 'Probe data could not be loaded. Planets are still shown.';
    banner.hidden = false;
  }
}

boot();
