import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperiment, setAxis, measure, clearResults, PREPARATIONS } from '../src/experiment.mjs';
import { probabilities } from '../src/quantum.mjs';
import { project } from '../src/geometry.mjs';

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('initial experiment is Z with no invented observations', () => {
  const state = createExperiment();
  assert.deepEqual(state.axis, [0, 0, 1]);
  assert.deepEqual(state.counts, [[0, 0], [0, 0]]);
  assert.deepEqual(state.last, [null, null]);
  assert.deepEqual(state.camera, { yaw: -0.45, pitch: 0.25 });
});

test('single and batch use independent random draws and accumulate per preparation', () => {
  const state = createExperiment();
  let calls = 0;
  const rng = () => (++calls % 2 ? 0.1 : 0.9);
  measure(state, 1, rng);
  assert.equal(calls, 2);
  assert.deepEqual(state.counts, [[1, 0], [0, 1]]);
  assert.deepEqual(state.last, [0, 1]);
  measure(state, 100, rng);
  assert.equal(calls, 202);
  assert.deepEqual(state.counts, [[101, 0], [0, 101]]);
});

test('X and reversed X batches are deterministic', () => {
  const state = createExperiment();
  setAxis(state, [1, 0, 0]);
  measure(state, 100, seeded(12));
  assert.deepEqual(state.counts, [[100, 0], [0, 100]]);
  setAxis(state, [-1, 0, 0]);
  measure(state, 100, seeded(12));
  assert.deepEqual(state.counts, [[0, 100], [100, 0]]);
});

test('actual axis changes reset observations while equal and invalid axes preserve them', () => {
  const state = createExperiment();
  measure(state, 100, seeded(12));
  const before = structuredClone(state);
  for (const axis of [[0, 0, 8], [0, 0, 0], [NaN, 0, 0], null]) {
    assert.equal(setAxis(state, axis), false);
    assert.deepEqual(state, before);
  }
  assert.equal(setAxis(state, [1, 2, 2]), true);
  assert.deepEqual(state.counts, [[0, 0], [0, 0]]);
  assert.deepEqual(state.last, [null, null]);
  assert.ok(Math.abs(Math.hypot(...state.axis) - 1) < 1e-12);
});

test('camera rotation and view reset cannot change physics or counts', () => {
  const state = createExperiment();
  setAxis(state, [1, 2, 2]);
  measure(state, 100, seeded(14));
  const axis = state.axis.slice(), counts = structuredClone(state.counts), last = state.last.slice();
  const theory = PREPARATIONS.map(r => probabilities(r, state.axis));
  for (const camera of [{ yaw: 2, pitch: 0.8 }, createExperiment().camera]) {
    state.camera = camera;
    project(state.axis, state.camera);
    assert.deepEqual(state.axis, axis);
    assert.deepEqual(state.counts, counts);
    assert.deepEqual(state.last, last);
    assert.deepEqual(PREPARATIONS.map(r => probabilities(r, state.axis)), theory);
  }
});

test('seeded batches conserve counts without forcing a balanced histogram', () => {
  const state = createExperiment();
  const rng = seeded(734);
  for (let i = 0; i < 10; i++) measure(state, 100, rng);
  state.counts.forEach(pair => assert.equal(pair[0] + pair[1], 1000));
  assert.notDeepEqual(state.counts, [[500, 500], [500, 500]]);
  clearResults(state);
  assert.deepEqual(state.counts, [[0, 0], [0, 0]]);
  assert.deepEqual(state.last, [null, null]);
});

test('batch uses captured probabilities and failed RNG does not partly commit counts', () => {
  const state = createExperiment();
  setAxis(state, [1, 0, 0]);
  measure(state, 100, () => {
    // Deliberately perturb axis inside a test RNG to prove no per-shot reread.
    state.axis = [0, 0, 1];
    return 0.25;
  });
  assert.deepEqual(state.counts, [[100, 0], [0, 100]]);
  const before = structuredClone(state);
  let calls = 0;
  assert.throws(() => measure(state, 100, () => ++calls === 3 ? NaN : 0.25));
  assert.deepEqual(state, before);
  for (const count of [-1, 1.5, Infinity, NaN]) assert.throws(() => measure(state, count));
  measure(state, 0, () => { throw new Error('Zero shots should not sample'); });
  assert.deepEqual(state, before);
});
