import './style.css';
import { webglProblem, showFatal } from './webgl.js';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

async function boot() {
  const problem = webglProblem();
  if (problem) {
    showFatal(problem);
    return;
  }

  const now = new Date();
  document.getElementById('date').textContent = dateFormat.format(now);
  document.getElementById('date').setAttribute('datetime', now.toISOString().slice(0, 10));

  const hint = document.getElementById('hint');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  hint.textContent = coarse
    ? 'Drag to rotate · Pinch to zoom · Two fingers to pan · Tap a planet to centre it'
    : 'Drag to rotate · Scroll to zoom · Right-drag to pan · Click a planet to centre it';

  let app;
  try {
    const { startApp } = await import('./app.js');
    app = startApp({
      container: document.getElementById('app'),
      date: now,
      onFatal: showFatal,
      onFocusChange: (info) => {
        document.getElementById('overview').hidden = info.id === 'Sun';
      },
    });
  } catch (err) {
    showFatal(`Starting the 3D view failed: ${err?.message || err}`);
    return;
  }

  document.getElementById('overview').addEventListener('click', () => app.resetView());
  window.__systemXp = app;
  document.documentElement.dataset.started = 'true';
}

boot();
