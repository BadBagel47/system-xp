// Lines drawn "relative to eye": every vertex is stored as a high and a low
// 32-bit part, and the camera position likewise, so the GPU subtracts them
// without losing precision. Keeps trails and orbits exact even when zoomed in
// to a few hundred km far from the Sun (where plain 32-bit floats in AU are
// only good to ~300 km).

import * as THREE from 'three';

/** Shared camera uniforms – update once per frame with updateRteCamera(). */
export const rteUniforms = {
  cameraHigh: { value: new THREE.Vector3() },
  cameraLow: { value: new THREE.Vector3() },
  viewRotation: { value: new THREE.Matrix4() },
};

const split = (v) => {
  const hi = Math.fround(v);
  return [hi, v - hi];
};

/** Call after the camera has moved and before rendering. */
export function updateRteCamera(camera) {
  camera.updateMatrixWorld();
  const p = camera.position;
  const [xh, xl] = split(p.x);
  const [yh, yl] = split(p.y);
  const [zh, zl] = split(p.z);
  rteUniforms.cameraHigh.value.set(xh, yh, zh);
  rteUniforms.cameraLow.value.set(xl, yl, zl);
  rteUniforms.viewRotation.value.copy(camera.matrixWorldInverse).setPosition(0, 0, 0);
}

const vertexShader = /* glsl */ `
  attribute vec3 positionLow;
  attribute float lineDistance;
  uniform vec3 cameraHigh;
  uniform vec3 cameraLow;
  uniform mat4 viewRotation;
  varying float vDistance;
  void main() {
    vec3 rel = (position - cameraHigh) + (positionLow - cameraLow);
    vDistance = lineDistance;
    gl_Position = projectionMatrix * viewRotation * vec4(rel, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  uniform float dashed;
  uniform float dashSize;
  uniform float gapSize;
  varying float vDistance;
  void main() {
    if (dashed > 0.5 && mod(vDistance, dashSize + gapSize) > dashSize) discard;
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;

/** A line material for geometries made with setRtePositions(). */
export function rteLineMaterial({ color, opacity = 1, dashed = false }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...rteUniforms,
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      dashed: { value: dashed ? 1 : 0 },
      dashSize: { value: 0.1 },
      gapSize: { value: 0.08 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Make (or refill) the attributes a geometry needs from double-precision positions.
 * `pos`: flat [x0, y0, z0, ...]; `dist` (optional): distance along the line per vertex.
 */
export function rteAttributes(pos, dist) {
  const n = pos.length / 3;
  const high = new Float32Array(n * 3);
  const low = new Float32Array(n * 3);
  fillHighLow(pos, high, low);
  return {
    position: new THREE.BufferAttribute(high, 3),
    positionLow: new THREE.BufferAttribute(low, 3),
    lineDistance: new THREE.BufferAttribute(dist ? Float32Array.from(dist) : new Float32Array(n), 1),
  };
}

export function fillHighLow(pos, high, low, offset = 0) {
  for (let i = 0; i < pos.length; i++) {
    const hi = Math.fround(pos[i]);
    high[offset + i] = hi;
    low[offset + i] = pos[i] - hi;
  }
}
