# Quantum Measurement Lab

An interactive, browser-only introduction to single-qubit measurements. Compare fixed plus/minus preparations on a rotatable Bloch sphere, choose a measurement direction, and explore theoretical probabilities and sampled outcomes.

## Run

This is a static browser application. No package installation, compilation, external API, or GPU is required. Serve this directory with a local HTTP server, for example:

```
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765 on the same machine. The local address is not a shareable public URL. A static host can serve index.html, styles.css, and src/ unchanged.

## Test

Node 24 was used for verification. The tests use Node's built-in test runner, with no third-party packages:

```
node --test tests/*.test.mjs
```

46 tests pass. They cover probabilities, independent sampling, cancellation, delayed arrivals, mobile/desktop coordinate wiring, the primer, signed Z labels, and guide/challenge evidence. DOM-double event tests are not rendered-browser tests. These checks cover model logic and event wiring; they do not establish rendered-browser visual correctness.

## Operation

- Drag the sphere background to rotate the view; drag a cyan endpoint to change the measurement axis.
- X/Z presets and keyboard-accessible angle controls set directions. Camera changes preserve the experiment; actual axis changes clear old results.
- Single trials and 100-trial runs prepare fresh A/B states independently. Particle flights illustrate outcomes, not real quantum trajectories. Counts update on arrival.
- Stop retains completed results. Axis changes, clear, scrolling, resizing, and page hiding safely cancel queued work. Off-screen/reduced-motion paths update without flights and show a note.
- Small screens use compact receiver boxes beside the sphere; detailed statistics remain below.
- The optional primer introduces bits, relative phase, and single measurement outcomes. The short guide requires completed 100-trial comparisons, and the challenge checks theoretical distinction plus actual current-setting measurements.
- At positive Z, Result 1/2 correspond to readouts 0/1; negative Z reverses the mapping. Other axes use generic outcome labels.

## Scientific model

The preparations are the plus and minus states with Bloch vectors r=(±1,0,0). For unit axis n, P(+n)=(1+r·n)/2 and P(−n)=1−P(+n). Z yields equal probabilities for both preparations; X yields opposite certain outcomes. Finite samples fluctuate. The app is a classical simulation of ideal measurement probabilities, not quantum hardware or a computational-speedup demonstration.

References:
- https://quantum.cloud.ibm.com/learning/en/modules/quantum-mechanics/superposition-with-qiskit
- https://quantum.cloud.ibm.com/learning/en/modules/quantum-mechanics/stern-gerlach-measurements-with-qiskit
- https://learning.quantum.ibm.com/course/general-formulation-of-quantum-information/general-measurements

## Code and planning

The source reference map is [devpost/app-map.html](devpost/app-map.html). The devpost/ directory contains the project scope, product requirements, technical specification, and verification checklist. The app uses no external runtime dependencies or third-party assets.

## License

Copyright (c) 2026 Chaoge Zhang. Released under the [MIT License](LICENSE).
