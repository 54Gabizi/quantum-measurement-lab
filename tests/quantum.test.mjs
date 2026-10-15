import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, probabilities, sample } from '../src/quantum.mjs';
const plus = [1, 0, 0], minus = [-1, 0, 0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);

test('X eigenstates and reversed X exchange outcomes exactly', () => {
  assert.deepEqual(probabilities(plus, plus), [1, 0]);
  assert.deepEqual(probabilities(minus, plus), [0, 1]);
  assert.deepEqual(probabilities(plus, minus), [0, 1]);
  assert.deepEqual(probabilities(minus, minus), [1, 0]);
});

test('Y and Z yield equal probabilities for both preparations', () => {
  for (const r of [plus, minus]) for (const n of [[0, 1, 0], [0, 0, 1]]) {
    assert.deepEqual(probabilities(r, n), [0.5, 0.5]);
  }
});

test('oblique formula, reversed direction, and normalization', () => {
  const n = [1, 2, 2];
  const expected = [2 / 3, 1 / 3];
  probabilities(plus, n).forEach((p, i) => near(p, expected[i]));
  probabilities(minus, n).forEach((p, i) => near(p, expected[1 - i]));
  probabilities(plus, n.map(x => -x)).forEach((p, i) => near(p, expected[1 - i]));
  assert.deepEqual(probabilities([8, 0, 0], [9, 0, 0]), [1, 0]);
  for (let i = 1; i <= 100; i++) {
    const p = probabilities(plus, [Math.cos(i), Math.sin(i), i / 100]);
    assert.equal(p[0] + p[1], 1);
    assert.ok(p.every(x => x >= 0 && x <= 1));
  }
});

test('normalization handles tiny and huge finite vectors without mutation', () => {
  for (const v of [[1e308, 1e308, 1e308], [1e-320, 0, 0], [0, 3, 4]]) {
    const original = v.slice();
    near(Math.hypot(...normalize(v)), 1);
    assert.deepEqual(v, original);
  }
  for (const v of [[0, 0, 0], [Infinity, 0, 1], [NaN, 1, 0], [1, 2], null]) assert.throws(() => normalize(v));
});

test('sampling respects threshold and deterministic endpoints', () => {
  assert.equal(sample([0.5, 0.5], () => 0), 0);
  assert.equal(sample([0.5, 0.5], () => 0.499999), 0);
  assert.equal(sample([0.5, 0.5], () => 0.5), 1);
  assert.equal(sample([0, 1], () => 0), 1);
  assert.equal(sample([1, 0], () => 1 - Number.EPSILON), 0);
  for (const draw of [-1, 1, Infinity, NaN]) assert.throws(() => sample([0.5, 0.5], () => draw));
  for (const p of [[-1, 2], [0.4, 0.4], [NaN, 1], [1], null]) assert.throws(() => sample(p));
});
