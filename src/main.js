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
      onFocusChange: (s) => ui?.onFocusChange(s),
      onSelect: (id) => ui?.onSelect(id),
    });
    ui = setupUi({ app, clock });
  } catch (err) {
    showFatal(`Starting the 3D view failed: ${err?.message || err}`);
    return;
  }
  window.__systemXp = { app, clock };
  document.documentElement.dataset.started = 'true';

  // Probe trajectories are loaded after the planets are on screen.
  try {
    const { loadProbeData } = await import('./probes.js');
    const list = await loadProbeData();
    app.addProbes(list);
    document.documentElement.dataset.probes = String(list.length);
  } catch (err) {
    console.warn('Probe data could not be loaded:', err);
    const banner = document.getElementById('banner');
    banner.textContent = 'Probe data could not be loaded. Planets are still shown.';
    banner.hidden = false;
  }
}

boot();
