import test from 'node:test';
import assert from 'node:assert/strict';
import { createTour, startTour, exitTour, noteRunStart, noteRunCompletion,
  assessChallenge, outcomeLabels } from '../src/tour.mjs';

const Z = [0, 0, 1], X = [1, 0, 0];
const finish = (tour, runId, axis = Z, extras = {}) => noteRunCompletion(tour,
  { runId, axis, completed: 100, total: 100, cancelled: false, ...extras });
const run = (tour, axis = Z, total = 100) => noteRunStart(tour, { axis, total });

test('tour progresses only on actual complete eligible Z then X batches', () => {
  const tour = createTour();
  assert.deepEqual(tour, { active: false, step: 'idle', run: null });
  assert.equal(run(tour), null);
  startTour(tour);
  assert.equal(tour.step, 'z');
  assert.equal(finish(tour, null), false);
  const z = run(tour);
  assert.equal(tour.step, 'z');
  assert.equal(finish(tour, z), true);
  assert.equal(tour.step, 'x');
  assert.equal(finish(tour, run(tour, X), X), true);
  assert.equal(tour.step, 'done');
  assert.equal(run(tour, X), null);
});

test('partial, cancelled, wrong-sized, wrong-axis, and unstarted runs cannot advance', () => {
  for (const extras of [{ completed: 99 }, { completed: 101 }, { completed: '100' },
    { cancelled: true }, { cancelled: undefined }, { total: 1 }, { axis: X }]) {
    const tour = startTour(createTour()), id = run(tour);
    assert.equal(finish(tour, id, Z, extras), false);
    assert.equal(tour.step, 'z');
    assert.equal(finish(tour, id), false, 'terminal evidence is consumed');
  }
  for (const axis of [X, [0, 0, -1], [0, 1e-6, 1], null]) {
    const tour = startTour(createTour());
    assert.equal(finish(tour, run(tour, axis), axis), false);
  }
  for (const total of [1, 99, 101, 200, '100']) {
    const tour = startTour(createTour());
    assert.equal(finish(tour, run(tour, Z, total)), false);
  }
});

test('cancellation, retry, restart and exit reject stale completion tokens', () => {
  const tour = startTour(createTour());
  const old = run(tour);
  assert.equal(finish(tour, old, Z, { completed: 50, cancelled: true }), false);
  const retry = run(tour);
  assert.equal(finish(tour, old), false);
  assert.equal(finish(tour, retry), true);
  const x = run(tour, X);
  startTour(tour);
  assert.equal(finish(tour, x, X), false);
  const next = run(tour);
  exitTour(tour);
  assert.equal(finish(tour, next), false);
  startTour(tour);
  const fresh = run(tour);
  assert.equal(finish(tour, next), false);
  assert.equal(finish(tour, fresh), true);
});

test('a newer ineligible start invalidates earlier eligible evidence', () => {
  const tour = startTour(createTour());
  const eligible = run(tour), one = run(tour, Z, 1);
  assert.equal(finish(tour, eligible), false);
  assert.equal(finish(tour, one, Z, { completed: 1, total: 1 }), false);
  assert.equal(tour.step, 'z');
});

test('both signed X axes complete the second step, but 99 percent cannot', () => {
  for (const axis of [X, [-1, 0, 0]]) {
    const tour = startTour(createTour());
    finish(tour, run(tour));
    assert.equal(finish(tour, run(tour, axis), axis), true);
    assert.equal(tour.step, 'done');
  }
  const almost = [.98, Math.sqrt(1 - .98 ** 2), 0];
  const tour = startTour(createTour());
  finish(tour, run(tour));
  assert.equal(finish(tour, run(tour, almost), almost), false);
  assert.equal(tour.step, 'x');
});

test('challenge requires endpoint theory plus measured current-setting arrivals', () => {
  for (const axis of [X, [-1, 0, 0], [5, 0, 0], [1, 6e-17, 6e-17]]) {
    assert.equal(assessChallenge(axis).axisAligned, true);
    assert.equal(assessChallenge(axis).success, false);
    assert.equal(assessChallenge(axis, { measuredTrials: 1 }).success, true);
  }
  for (const measuredTrials of [0, -1, .5, NaN, Infinity, '1']) {
    assert.equal(assessChallenge(X, { measuredTrials }).success, false);
  }
  for (const axis of [Z, [0, 1, 0], [.98, Math.sqrt(1-.98**2), 0],
    [1, 1e-6, 0], [0, 0, 0], null, [NaN, 0, 0]]) {
    assert.equal(assessChallenge(axis, { measuredTrials: 100,
      counts: [[100, 0], [0, 100]], camera: { yaw: 0, pitch: 0 } }).success, false);
  }
});

test('Z labels reverse at negative Z and stay generic at every other direction', () => {
  assert.deepEqual(outcomeLabels(Z), { first: 'Result 1 · readout 0', second: 'Result 2 · readout 1' });
  assert.deepEqual(outcomeLabels([0, 0, -9]), { first: 'Result 1 · readout 1', second: 'Result 2 · readout 0' });
  for (const axis of [X, [-1, 0, 0], [0, 1, 0], [1e-6, 0, 1], [1e-13, 0, 1], null]) {
    assert.deepEqual(outcomeLabels(axis), { first: 'Result 1', second: 'Result 2' });
  }
});

test('helpers snapshot inputs and never alter physics or view state', () => {
  const axis = Z.slice(), tour = startTour(createTour());
  const id = run(tour, axis);
  axis[0] = 1;
  assert.equal(finish(tour, id), true, 'run axis is a detached snapshot');
  const state = { axis: X.slice(), counts: [[3, 0], [0, 3]], camera: { yaw: 2, pitch: 1 } };
  const before = structuredClone(state);
  assessChallenge(state.axis, { measuredTrials: 3 });
  outcomeLabels(state.axis);
  exitTour(tour);
  assert.deepEqual(state, before);
});

test('real runner integration waits for all arrivals and rejects a cancelled partial batch', async () => {
  const { createRunner } = await import('../src/runner.mjs');
  const { createExperiment, setAxis } = await import('../src/experiment.mjs');
  const state = createExperiment(), tour = startTour(createTour());
  let token = null, now = 0, sequence = 0;
  const jobs = new Map();
  const runner = createRunner({ state, interval: 1, onPrepare: () => 1000,
    schedule(fn, delay) { const id = ++sequence; jobs.set(id, { fn, at: now + delay }); return id; },
    cancelSchedule(id) { jobs.delete(id); },
    onStatus(status) {
      if (status.running) token = noteRunStart(tour, { axis: state.axis, total: status.total });
      else noteRunCompletion(tour, { ...status, axis: state.axis, runId: token });
    },
  });
  const tick = () => {
    const [id, job] = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
    jobs.delete(id); now = job.at; job.fn();
  };
  runner.start(100);
  for (let i = 0; i < 100; i++) tick(); // All launched, none arrived.
  assert.equal(tour.step, 'z');
  assert.deepEqual(state.counts, [[0, 0], [0, 0]]);
  for (let i = 0; i < 99; i++) tick();
  assert.equal(tour.step, 'z');
  tick();
  assert.equal(tour.step, 'x');
  setAxis(state, X);
  runner.start(100);
  for (let i = 0; i < 150; i++) tick(); // 100 launches, only 50 arrivals.
  runner.cancel();
  assert.equal(tour.step, 'x');
  assert.equal(jobs.size, 0);
  runner.start(100);
  while (jobs.size) tick();
  assert.equal(tour.step, 'done');
});
