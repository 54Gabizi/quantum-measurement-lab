import { normalize, probabilities } from './quantum.mjs';
import { PREPARATIONS } from './experiment.mjs';

// Angular endpoint tolerance is only for floating-point trigonometric residue.
// It must not turn a merely high probability (such as 99%) into certainty.
const ENDPOINT_TOLERANCE = 4 * Number.EPSILON;
const normalized = axis => {
  try { return normalize(axis); } catch { return null; }
};
const atPole = (axis, index, sign) => axis !== null && axis.every((value, i) =>
  Math.abs(value - (i === index ? sign : 0)) <= ENDPOINT_TOLERANCE);
const sameAxis = (a, b) => a !== null && b !== null &&
  a.every((value, i) => Math.abs(value - b[i]) <= ENDPOINT_TOLERANCE);

/** Labels refer to the physical +n / -n result ordering. Only Z is readout 0/1. */
export function outcomeLabels(axis) {
  const n = normalized(axis);
  if (atPole(n, 2, 1)) return {
    first: 'Result 1 · readout 0', second: 'Result 2 · readout 1',
  };
  if (atPole(n, 2, -1)) return {
    first: 'Result 1 · readout 1', second: 'Result 2 · readout 0',
  };
  return { first: 'Result 1', second: 'Result 2' };
}

/** measuredTrials must count completed arrivals at the CURRENT axis setting.
 * This checks theory, not the chance appearance of a finite histogram.
 * Camera state and observed outcome frequencies are deliberately irrelevant.
 */
export function assessChallenge(axis, { measuredTrials = 0 } = {}) {
  const n = normalized(axis);
  const distributions = n ? PREPARATIONS.map(r => probabilities(r, n)) : null;
  const aligned = atPole(n, 0, 1) || atPole(n, 0, -1);
  const opposite = distributions !== null &&
    ((distributions[0][0] === 1 && distributions[1][0] === 0) ||
     (distributions[0][0] === 0 && distributions[1][0] === 1));
  const axisAligned = aligned && opposite;
  const hasMeasurements = Number.isSafeInteger(measuredTrials) && measuredTrials >= 1;
  return { success: axisAligned && hasMeasurements, axisAligned,
    hasMeasurements, probabilities: distributions };
}

export function createTour() {
  return { active: false, step: 'idle', run: null };
}

/** Starting/restarting forgets previous tour evidence, never experiment data. */
export function startTour(tour) {
  tour.active = true;
  tour.step = 'z';
  tour.run = null;
  return tour;
}

export function exitTour(tour) {
  tour.active = false;
  tour.step = 'idle';
  tour.run = null;
  return tour;
}

/** Call only when the runner actually starts, not when a button is clicked.
 * Keep the returned opaque token and pass it to the matching terminal event.
 * Every start invalidates the previous run, including an ineligible retry.
 */
export function noteRunStart(tour, { axis, total }) {
  tour.run = null;
  if (!tour.active || !['z', 'x'].includes(tour.step)) return null;
  const n = normalized(axis);
  const eligible = total === 100 && (tour.step === 'z'
    ? atPole(n, 2, 1)
    : assessChallenge(n).axisAligned);
  const runId = Symbol('tour run');
  tour.run = { runId, axis: n, total, step: tour.step, eligible };
  return runId;
}

/** Call for completion OR cancellation using the original run token.
 * Only all 100 actual arrivals of one eligible fresh run can advance a step.
 * Matching terminal events consume the run; stale events cannot consume retries.
 */
export function noteRunCompletion(tour, { runId, axis, completed, total, cancelled }) {
  const run = tour.run;
  if (!run || !runId || run.runId !== runId) return false;
  tour.run = null;
  if (!tour.active || tour.step !== run.step || !run.eligible ||
      cancelled !== false || total !== 100 || total !== run.total || completed !== 100 ||
      !sameAxis(run.axis, normalized(axis))) return false;
  tour.step = tour.step === 'z' ? 'x' : 'done';
  return true;
}
