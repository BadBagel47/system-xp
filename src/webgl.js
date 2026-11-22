// WebGL support check and the "3D could not start" message.

/** Returns null if WebGL 2 looks usable, otherwise a short reason string. */
export function webglProblem() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      const gl1 = canvas.getContext('webgl');
      return gl1
        ? 'Only WebGL 1 is available; WebGL 2 is required.'
        : 'The browser did not provide a WebGL context.';
    }
    if (gl.isContextLost()) return 'The WebGL context was lost right after it was created.';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  } catch (err) {
    return `Creating a WebGL context failed: ${err?.message || err}`;
  }
}

/** Replace the page with a clear, friendly error message. */
export function showFatal(reason) {
  const box = document.getElementById('fatal');
  if (!box) return;
  const detail = box.querySelector('[data-detail]');
  if (detail) detail.textContent = reason || 'Unknown error.';
  box.hidden = false;
  document.getElementById('loading')?.setAttribute('hidden', '');
  document.getElementById('app')?.setAttribute('hidden', '');
  document.documentElement.classList.add('is-fatal');
}
