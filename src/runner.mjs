import { PREPARATIONS } from './experiment.mjs';
import { probabilities, sample } from './quantum.mjs';

/** Launch fresh, independent A/B measurements at a fixed cadence.
 * onPrepare receives sampled outcomes and returns their flight time in ms.
 * Visible results commit only on arrival; omitted/zero delay commits at launch.
 * Schedulers must defer callbacks (like setTimeout, including at interval 0).
 * Changing axes/resetting belongs to the caller, which must cancel first.
 * Callback arrays are detached snapshots, and probabilities are fixed per run.
 */
export function createRunner({
  state,
  onPrepare = () => 0,
  onShot = () => {},
  onStatus = () => {},
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelSchedule = handle => clearTimeout(handle),
  rng = Math.random,
  interval = 65,
}) {
  if (!Number.isFinite(interval) || interval < 0) {
    throw new RangeError('Interval must be a nonnegative finite number.');
  }
  let epoch = 0;
  let active = null;
  const current = run => active === run && run.epoch === epoch;
  const status = (run, running, cancelled) => onStatus({
    running, completed: run.completed, total: run.total, cancelled,
  });

  function cancel() {
    const run = active;
    ++epoch; // Invalidate callbacks even when a scheduler cannot remove them.
    active = null;
    if (!run) return false;
    for (const ticket of run.pending) cancelSchedule(ticket.handle);
    run.pending.clear();
    status(run, false, true);
    return true;
  }

  function enqueue(run, callback, delay) {
    const ticket = { handle: null };
    run.pending.add(ticket);
    ticket.handle = schedule(() => {
      // Also reject duplicate invocations from an already-consumed ticket.
      if (!current(run) || !run.pending.delete(ticket)) return;
      try {
        callback();
      } catch (error) {
        if (current(run)) cancel();
        throw error;
      }
    }, delay);
  }

  function arrive(run, last) {
    if (!current(run)) return;
    const counts = state.counts.map(pair => pair.slice());
    for (let preparation = 0; preparation < last.length; preparation++) {
      if (!Number.isSafeInteger(counts[preparation][0] + counts[preparation][1] + 1)) {
        throw new RangeError('Trial count would exceed precise integer storage.');
      }
      counts[preparation][last[preparation]]++;
    }
    state.counts = counts;
    state.last = last.slice();
    ++run.completed;
    onShot({
      index: run.completed,
      total: run.total,
      counts: counts.map(pair => pair.slice()),
      last: last.slice(),
    });
    // Callbacks may cancel (and even start another run).
    if (!current(run)) return;
    if (run.completed === run.total) {
      active = null;
      status(run, false, false);
    }
  }

  function launch(run) {
    const last = run.distributions.map(distribution => sample(distribution, rng));
    if (!current(run)) return;
    ++run.launched;
    const delay = onPrepare({ index: run.launched, total: run.total, last: last.slice() }) ?? 0;
    if (!current(run)) return;
    if (!Number.isFinite(delay) || delay < 0) {
      throw new RangeError('Arrival delay must be a nonnegative finite number.');
    }
    if (delay === 0) arrive(run, last);
    else enqueue(run, () => arrive(run, last), delay);
    if (current(run) && run.launched < run.total) {
      enqueue(run, () => launch(run), interval);
    }
  }

  function start(shots = 100) {
    if (active) return false;
    if (!Number.isSafeInteger(shots) || shots < 1) {
      throw new RangeError('Shot count must be a positive safe integer.');
    }
    if (state.counts.some(pair => !Number.isSafeInteger(pair[0] + pair[1] + shots))) {
      throw new RangeError('Trial count would exceed precise integer storage.');
    }
    const distributions = PREPARATIONS.map(r => probabilities(r, state.axis));
    const run = { epoch: ++epoch, launched: 0, completed: 0, total: shots,
      distributions, pending: new Set() };
    active = run;
    try {
      status(run, true, false);
      if (current(run)) enqueue(run, () => launch(run), interval);
    } catch (error) {
      if (current(run)) cancel();
      throw error;
    }
    return true;
  }

  return { start, cancel, isRunning: () => active !== null };
}
