/** Normalize a finite, nonzero 3-vector without overflowing its length. */
export function normalize(v) {
  if (!v || v.length !== 3 || !Array.from(v).every(Number.isFinite)) {
    throw new TypeError('Expected three finite vector components.');
  }
  const scale = Math.max(...Array.from(v, Math.abs));
  if (scale === 0) throw new RangeError('A zero vector has no direction.');
  const scaled = Array.from(v, component => component / scale);
  const length = Math.hypot(...scaled);
  return scaled.map(component => component / length);
}

/** Ideal projective measurement of a pure Bloch preparation r along n. */
export function probabilities(r, n) {
  const state = normalize(r);
  const axis = normalize(n);
  const dot = Math.max(-1, Math.min(1, state.reduce((sum, x, i) => sum + x * axis[i], 0)));
  let plus = (1 + dot) / 2;
  // Remove machine-rounding residue only at deterministic endpoints.
  if (plus < 4 * Number.EPSILON) plus = 0;
  if (1 - plus < 4 * Number.EPSILON) plus = 1;
  return [plus, 1 - plus];
}

/** Sample +n (0) or −n (1). The injected random source must return [0,1). */
export function sample(distribution, rng = Math.random) {
  if (!distribution || distribution.length !== 2 ||
      !Array.from(distribution).every(p => Number.isFinite(p) && p >= 0 && p <= 1) ||
      Math.abs(distribution[0] + distribution[1] - 1) > 1e-12) {
    throw new RangeError('Expected two nonnegative probabilities summing to one.');
  }
  const draw = rng();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError('Random source must return a finite number in [0,1).');
  }
  return draw < distribution[0] ? 0 : 1;
}
