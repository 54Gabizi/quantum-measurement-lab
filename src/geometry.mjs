import { normalize } from './quantum.mjs';

/** Orthonormal screen basis: x right, y up, z toward the viewer.
 * At zero angles, world +X is right, +Z is up and −Y faces the viewer.
 */
export function cameraBasis(yaw, pitch) {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new TypeError('Camera angles must be finite.');
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    right: [cy, sy, 0],
    up: [-sy * sp, cy * sp, cp],
    toward: [sy * cp, -cy * cp, sp],
  };
}

function finiteVector(v) {
  if (!v || v.length !== 3 || !Array.from(v).every(Number.isFinite)) throw new TypeError('Expected three finite components.');
}

export function project(v, camera) {
  finiteVector(v);
  const { right, up, toward } = cameraBasis(camera.yaw, camera.pitch);
  return [right, up, toward].map(axis => axis.reduce((sum, x, i) => sum + x * v[i], 0));
}

export function unproject(v, camera) {
  finiteVector(v);
  const { right, up, toward } = cameraBasis(camera.yaw, camera.pitch);
  return [0, 1, 2].map(i => right[i] * v[0] + up[i] * v[1] + toward[i] * v[2]);
}

/** Positive-z virtual trackball; coordinates are in units of sphere radius.
 * Points outside the disk remain on its rim, including very large inputs.
 */
export function trackball(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Pointer coordinates must be finite.');
  const radius = Math.hypot(x, y);
  if (radius >= 1) return normalize([x, y, 0]);
  return normalize([x, y, Math.sqrt(Math.max(0, 1 - radius * radius))]);
}
