import { normalize, probabilities, sample } from './quantum.mjs';

export const PREPARATIONS = Object.freeze([
  Object.freeze([1, 0, 0]),
  Object.freeze([-1, 0, 0]),
]);

export function createExperiment() {
  return {
    axis: [0, 0, 1],
    camera: { yaw: -0.45, pitch: 0.25 },
    counts: [[0, 0], [0, 0]],
    last: [null, null],
  };
}

export function clearResults(state) {
  state.counts = [[0, 0], [0, 0]];
  state.last = [null, null];
  return state;
}

/** Invalid directions leave the last valid experiment untouched. */
export function setAxis(state, n) {
  let next;
  try { next = normalize(n); } catch { return false; }
  if (next.every((x, i) => Math.abs(x - state.axis[i]) <= 1e-12)) return false;
  state.axis = next;
  clearResults(state);
  return true;
}

/** Each shot measures a fresh preparation of BOTH alternatives independently.
 * Distributions are captured before sampling; results commit atomically.
 */
export function measure(state, shots = 1, rng = Math.random) {
  if (!Number.isSafeInteger(shots) || shots < 0) throw new RangeError('Shot count must be a nonnegative safe integer.');
  if (state.counts.some(pair => !Number.isSafeInteger(pair[0] + pair[1] + shots))) {
    throw new RangeError('Trial count would exceed precise integer storage.');
  }
  const distributions = PREPARATIONS.map(r => probabilities(r, state.axis));
  const counts = state.counts.map(pair => pair.slice());
  const last = state.last.slice();
  for (let shot = 0; shot < shots; shot++) {
    for (let preparation = 0; preparation < PREPARATIONS.length; preparation++) {
      const outcome = sample(distributions[preparation], rng);
      counts[preparation][outcome]++;
      last[preparation] = outcome;
    }
  }
  state.counts = counts;
  state.last = last;
  return state;
}
