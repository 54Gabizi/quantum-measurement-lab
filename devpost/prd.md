---
doc: prd
status: implemented
---
# Product Requirements

## Core Journey
Open the English experiment, optionally use the primer/short guide, rotate the Bloch-sphere view, select a measurement direction, and observe independently measured fresh preparations A/B. Compare theoretical probabilities with arrived outcomes and counts.

## Look and Feel
Simple technological styling, restrained colors, clear state/axis labels, and a responsive layout. The Bloch sphere and measurement remain central. Mathematical definitions are expandable.

## Fixed Preparations and Direction Controls
A and B represent plus/minus states, not different particle species or two simultaneous states of one qubit. Their vectors remain ±X. Background dragging rotates the view only. Cyan handles change the measurement axis; X/Z presets and keyboard angle controls provide exact directions.

## Measurement and Results
One or 100 new qubits per preparation are sampled independently. Counts accumulate at a fixed axis and clear on a real axis change. Flights travel from the sphere to the correct preparation/outcome receiver; counting occurs on arrival. Stop preserves completed arrivals. Cancellation prevents stale callbacks from affecting new runs. Reduced motion or truly off-screen endpoints use a disclosed nonanimated fallback. Mobile compact receivers keep the core experiment visible.

## Readouts
At +Z, Result 1/2 map to classical readouts 0/1; at −Z this reverses. Other measurement axes retain generic outcome labels.

## Introductory Primer
An initially folded, independent three-step panel covers a classical bit, two equal amplitudes with relative phase, and one result from each freshly prepared measurement. Explicit buttons bridge to the existing Z/X experiment. General quantum-algorithm advantages are described cautiously; the one-qubit demonstration is not speedup evidence.

## Guided Comparison and Challenge
A prominent short guide requires a completed 100-arrival Z comparison and then a completed 100-arrival X comparison. Wrong-axis, old, partial, and cancelled runs do not advance. Direction selection/scrolling happens before the learner starts the live run. Exit leaves the free experiment unchanged.

The challenge resets explicitly to Z, holds preparations fixed, and requires a changed measurement direction, a completed current-setting measurement, and exact opposite theoretical outcomes. Either X orientation passes; camera motion, rounded percentages, and lucky histograms cannot pass.

## Acceptance Criteria
- Z probabilities are 50/50 for both states; X outcomes are deterministic and opposite.
- Camera-only changes preserve probabilities and counts.
- Actual axis changes reset results and cancel incompatible pending work.
- Every completed run conserves trial counts; A/B samples are independent.
- Signed Z labels are correct and arbitrary axes are not mislabeled as computational readouts.
- Keyboard/mobile controls support the same core operations.
- Guide/challenge progress depends on real measurement evidence.
