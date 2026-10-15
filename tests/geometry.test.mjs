import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraBasis, project, unproject, trackball } from '../src/geometry.mjs';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

test('neutral view places X right, Z up, and negative Y toward viewer', () => {
  const camera = { yaw: 0, pitch: 0 };
  project([1, 0, 0], camera).forEach((v, i) => near(v, [1, 0, 0][i]));
  project([0, 0, 1], camera).forEach((v, i) => near(v, [0, 1, 0][i]));
  project([0, -1, 0], camera).forEach((v, i) => near(v, [0, 0, 1][i]));
});

test('camera basis is orthonormal and projection roundtrips both hemispheres', () => {
  for (const yaw of [-Math.PI, -0.45, 0, 1, 8]) for (const pitch of [-Math.PI / 2, 0, 0.25, Math.PI / 2]) {
    const camera = { yaw, pitch };
    const basis = Object.values(cameraBasis(yaw, pitch));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(dot(basis[i], basis[j]), i === j ? 1 : 0);
    for (const vector of [[1, 0, 0], [-1, 0, 0], [0.3, -0.7, 0.8], [0, 0, 0]]) {
      const result = unproject(project(vector, camera), camera);
      result.forEach((v, i) => near(v, vector[i]));
      near(Math.hypot(...project(vector, camera)), Math.hypot(...vector));
    }
  }
});

test('trackball remains finite and unit length at center, rim, and outside', () => {
  assert.deepEqual(trackball(0, 0), [0, 0, 1]);
  for (const [x, y] of [[0.2, 0.4], [1, 0], [-4, 3], [1e308, 1e308]]) {
    const point = trackball(x, y);
    assert.ok(point.every(Number.isFinite));
    near(Math.hypot(...point), 1);
    assert.ok(point[2] >= 0);
  }
  for (const args of [[NaN, 0], [0, Infinity]]) assert.throws(() => trackball(...args));
  assert.throws(() => project([1, 0, 0], { yaw: NaN, pitch: 0 }));
  assert.throws(() => unproject([0, Infinity, 0], { yaw: 0, pitch: 0 }));
});
