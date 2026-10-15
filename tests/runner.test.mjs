import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../src/runner.mjs';
import { createExperiment, measure, setAxis } from '../src/experiment.mjs';

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function harness(options = {}) {
  const state = createExperiment();
  const shots = [], statuses = [], queue = [], cancelled = [];
  const runner = createRunner({
    state,
    onShot: shot => shots.push(shot),
    onStatus: status => statuses.push(status),
    schedule: (fn, ms) => {
      const job = { fn, ms };
      queue.push(job);
      return job;
    },
    // Retain cancelled jobs so tests can deliberately invoke stale callbacks.
    cancelSchedule: job => cancelled.push(job),
    rng: seeded(123),
    ...options,
  });
  return { state, shots, statuses, queue, cancelled, runner,
    tick: () => queue.shift().fn() };
}

test('default run schedules 100 individual fresh measurements with full lifecycle', () => {
  let draws = 0;
  const h = harness({ rng: () => ++draws % 2 ? 0.1 : 0.9 });
  assert.equal(h.runner.isRunning(), false);
  assert.equal(h.runner.start(), true);
  assert.equal(h.runner.isRunning(), true);
  assert.equal(draws, 0);
  assert.deepEqual(h.statuses, [{ running: true, completed: 0, total: 100, cancelled: false }]);
  for (let i = 1; i <= 100; i++) {
    assert.equal(h.queue.length, 1);
    assert.equal(h.queue[0].ms, 65);
    h.tick();
    assert.equal(h.shots.length, i);
    assert.deepEqual(h.shots[i - 1], {
      index: i, total: 100, counts: [[i, 0], [0, i]], last: [0, 1],
    });
    assert.equal(draws, i * 2);
  }
  assert.equal(h.queue.length, 0);
  assert.equal(h.runner.isRunning(), false);
  assert.deepEqual(h.statuses[1], { running: false, completed: 100, total: 100, cancelled: false });
});

test('repeated start refuses overlap and a finished runner can run again', () => {
  const h = harness();
  assert.equal(h.runner.start(1), true);
  assert.equal(h.runner.start(100), false);
  assert.equal(h.queue.length, 1);
  h.tick();
  assert.equal(h.runner.start(1), true);
  h.tick();
  h.state.counts.forEach(pair => assert.equal(pair[0] + pair[1], 2));
  assert.equal(h.statuses.length, 4);
});

test('cancel preserves completed shots and invalidates escaped callbacks across axis resets and restarts', () => {
  const h = harness();
  h.runner.start(100);
  h.tick();
  const stale = h.queue.shift();
  assert.equal(h.runner.cancel(), true);
  assert.deepEqual(h.cancelled, [stale]);
  assert.deepEqual(h.statuses.at(-1), { running: false, completed: 1, total: 100, cancelled: true });
  assert.equal(h.runner.cancel(), false);
  setAxis(h.state, [1, 0, 0]);
  h.runner.start(1);
  const before = structuredClone(h.state);
  stale.fn();
  assert.deepEqual(h.state, before);
  assert.equal(h.shots.length, 1);
  assert.equal(h.runner.isRunning(), true);
  h.tick();
  assert.deepEqual(h.state.counts, [[1, 0], [0, 1]]);
  stale.fn();
  assert.equal(h.shots.length, 2);
  assert.equal(h.statuses.length, 4);
});

test('cancel before first shot prevents sampling', () => {
  const h = harness({ rng: () => { throw new Error('Must not sample'); } });
  h.runner.start(1);
  h.runner.cancel();
  h.tick();
  assert.deepEqual(h.state.counts, [[0, 0], [0, 0]]);
  assert.equal(h.shots.length, 0);
  assert.equal(h.statuses.at(-1).completed, 0);
});

test('seeded results equal independent batch draws and snapshots never alias state or earlier frames', () => {
  const h = harness();
  const expected = createExperiment();
  measure(expected, 100, seeded(123));
  h.runner.start(100);
  h.tick();
  const first = structuredClone(h.shots[0]);
  for (let i = 1; i < 100; i++) h.tick();
  assert.deepEqual(h.state.counts, expected.counts);
  assert.deepEqual(h.state.last, expected.last);
  assert.deepEqual(h.shots[0], first);
  assert.notStrictEqual(h.shots[0].counts[0], h.shots[1].counts[0]);
  const finalState = structuredClone(h.state);
  h.shots.at(-1).counts[0][0] = -99;
  h.shots.at(-1).last[0] = -99;
  assert.deepEqual(h.state, finalState);
});

test('one-shot and reduced-motion runs still yield scheduled fresh updates', () => {
  const h = harness({ interval: 0 });
  h.runner.start(1);
  assert.equal(h.queue[0].ms, 0);
  assert.equal(h.shots.length, 0);
  h.tick();
  assert.equal(h.shots[0].index, 1);
  assert.equal(h.shots[0].total, 1);
  assert.deepEqual(h.statuses.at(-1), { running: false, completed: 1, total: 1, cancelled: false });
  assert.equal(h.runner.isRunning(), false);
});

test('cancelling inside callbacks cannot schedule another old tick', () => {
  let h;
  h = harness({ onShot: () => h.runner.cancel() });
  h.runner.start(100);
  h.tick();
  assert.equal(h.queue.length, 0);
  assert.equal(h.runner.isRunning(), false);
  assert.equal(h.statuses.at(-1).cancelled, true);
});

test('invalid configuration and failed sampling leave no active run', () => {
  assert.throws(() => harness({ interval: -1 }), RangeError);
  const h = harness({ rng: () => NaN });
  for (const shots of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => h.runner.start(shots), RangeError);
  }
  h.runner.start(1);
  assert.throws(() => h.tick(), RangeError);
  assert.equal(h.runner.isRunning(), false);
  assert.equal(h.queue.length, 0);
  assert.deepEqual(h.state.counts, [[0, 0], [0, 0]]);
});

// Clock-ordered scheduler lets launch cadence overlap multiple flight arrivals.
function clockHarness(options = {}) {
  let now = 0;
  const jobs = [], cancelled = [], preparations = [];
  const h = harness({
    onPrepare: shot => { preparations.push(shot); return 350; },
    schedule: (fn, ms) => {
      const job = { fn, ms, due: now + ms };
      jobs.push(job);
      return job;
    },
    cancelSchedule: job => cancelled.push(job),
    ...options,
  });
  return { ...h, jobs, cancelled, preparations,
    advanceTo(time) {
      while (true) {
        jobs.sort((a, b) => a.due - b.due);
        if (!jobs.length || jobs[0].due > time) break;
        const job = jobs.shift();
        now = job.due;
        job.fn();
      }
      now = time;
    },
  };
}

test('flights launch independently while counts and last wait for arrivals', () => {
  const h = clockHarness();
  h.runner.start(8);
  h.advanceTo(390);
  assert.equal(h.preparations.length, 6);
  assert.deepEqual(h.preparations.map(shot => shot.index), [1, 2, 3, 4, 5, 6]);
  assert.ok(h.preparations.every(shot => shot.total === 8 && shot.last.length === 2));
  assert.deepEqual(h.state.counts, [[0, 0], [0, 0]]);
  assert.deepEqual(h.state.last, [null, null]);
  assert.equal(h.shots.length, 0);
  h.advanceTo(415);
  assert.equal(h.shots.length, 1);
  assert.deepEqual(h.state.last, h.preparations[0].last);
  h.advanceTo(520);
  assert.equal(h.preparations.length, 8);
  assert.equal(h.shots.length, 2);
  assert.equal(h.runner.isRunning(), true);
  assert.equal(h.runner.start(1), false);
  assert.equal(h.statuses.length, 1);
  h.advanceTo(869);
  assert.equal(h.shots.length, 7);
  assert.equal(h.runner.isRunning(), true);
  h.advanceTo(870);
  assert.equal(h.shots.length, 8);
  assert.deepEqual(h.statuses.at(-1), { running: false, completed: 8, total: 8, cancelled: false });
  assert.equal(h.runner.isRunning(), false);
  assert.equal(h.jobs.length, 0);
});

test('cancel clears every outstanding launch and arrival and stale callbacks cannot touch a restart', () => {
  const h = clockHarness();
  h.runner.start(10);
  h.advanceTo(260);
  const stale = h.jobs.slice();
  assert.equal(stale.length, 5); // Four arrivals and the next launch.
  h.runner.cancel();
  assert.equal(h.cancelled.length, 5);
  assert.ok(stale.every(job => h.cancelled.includes(job)));
  assert.equal(h.statuses.at(-1).completed, 0);
  setAxis(h.state, [1, 0, 0]);
  h.runner.start(1);
  const before = structuredClone(h.state);
  stale.forEach(job => job.fn());
  assert.deepEqual(h.state, before);
  assert.equal(h.preparations.length, 4);
  h.advanceTo(675);
  assert.deepEqual(h.state.counts, [[1, 0], [0, 1]]);
  assert.equal(h.shots.length, 1);
  stale.forEach(job => job.fn());
  assert.equal(h.shots.length, 1);
  assert.equal(h.statuses.length, 4);
});

test('arrival order drives completion indices and preparation snapshots cannot alter outcomes', () => {
  const h = clockHarness({
    rng: () => 0.1,
    onPrepare: shot => { shot.last.fill(1); return shot.index === 1 ? 350 : 0; },
  });
  h.runner.start(2);
  h.advanceTo(130);
  assert.equal(h.shots.length, 1);
  assert.equal(h.shots[0].index, 1);
  assert.deepEqual(h.shots[0].last, [0, 0]);
  assert.equal(h.runner.isRunning(), true);
  h.advanceTo(415);
  assert.equal(h.shots[1].index, 2);
  assert.deepEqual(h.state.counts, [[2, 0], [2, 0]]);
  assert.equal(h.runner.isRunning(), false);
});

test('probabilities are captured before callbacks and stay fixed for a run', () => {
  const h = clockHarness({ rng: () => 0.75 });
  h.state.axis = [1, 0, 0];
  h.runner.start(2);
  h.state.axis = [-1, 0, 0];
  h.advanceTo(480);
  assert.deepEqual(h.state.counts, [[2, 0], [0, 2]]);
});

test('preparation and arrival errors cancel all pending work', () => {
  for (const failure of ['preparation', 'delay', 'arrival']) {
    const h = clockHarness({
      onPrepare: shot => {
        if (failure === 'preparation' && shot.index === 2) throw new Error('Prepare failed');
        if (failure === 'delay' && shot.index === 2) return -1;
        return 350;
      },
      onShot: () => { if (failure === 'arrival') throw new Error('Arrival failed'); },
    });
    h.runner.start(10);
    assert.throws(() => h.advanceTo(500), /failed|delay/);
    assert.equal(h.runner.isRunning(), false);
    assert.ok(h.cancelled.length > 0);
    const before = structuredClone(h.state);
    h.jobs.forEach(job => job.fn());
    assert.deepEqual(h.state, before);
    assert.equal(h.statuses.at(-1).cancelled, true);
  }
});

test('cancelling during preparation prevents arrival and duplicate callbacks are inert', () => {
  let h;
  h = clockHarness({ onPrepare: () => { h.runner.cancel(); return 350; } });
  h.runner.start(2);
  h.advanceTo(65);
  assert.deepEqual(h.state.counts, [[0, 0], [0, 0]]);
  assert.equal(h.jobs.length, 0);
  const other = clockHarness();
  other.runner.start(2);
  const launch = other.jobs[0];
  other.advanceTo(65);
  launch.fn();
  assert.equal(other.preparations.length, 1);
  const arrival = other.jobs.find(job => job.ms === 350);
  other.advanceTo(415);
  arrival.fn();
  assert.equal(other.shots.length, 1);
  other.advanceTo(480);
  assert.equal(other.shots.length, 2);
});
