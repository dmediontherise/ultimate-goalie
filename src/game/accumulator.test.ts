import { describe, expect, it } from 'vitest';
import { advanceAccumulator, createAccumulator, FIXED_DT, MAX_ACCUMULATED_TIME } from './accumulator';

describe('Accumulator (Requirement 6)', () => {
  it('drives step with fixed 1/120s steps', () => {
    const acc = createAccumulator();
    let stepCount = 0;
    const dts: number[] = [];

    // Advance 1/60 of a second (two 1/120 steps)
    advanceAccumulator(acc, 1 / 60, (dt) => {
      stepCount++;
      dts.push(dt);
    });

    expect(stepCount).toBe(2);
    expect(dts).toEqual([FIXED_DT, FIXED_DT]);
    expect(acc.time).toBeCloseTo(0);
  });

  it('clamps accumulated time to at most 0.25s to prevent spiral of death', () => {
    const acc = createAccumulator();
    let stepCount = 0;

    // Simulate backgrounded tab returning after 5 seconds
    const stepsRun = advanceAccumulator(acc, 5.0, () => {
      stepCount++;
    });

    // 0.25s / (1/120s) = 30 steps max
    expect(stepsRun).toBe(30);
    expect(stepCount).toBe(30);
    expect(acc.time).toBeLessThan(FIXED_DT);
  });

  it('preserves leftover accumulator time across frames', () => {
    const acc = createAccumulator();
    let totalSteps = 0;

    // Advance 0.01s (slightly more than 1/120 = 0.008333s)
    advanceAccumulator(acc, 0.01, () => {
      totalSteps++;
    });
    expect(totalSteps).toBe(1);
    expect(acc.time).toBeCloseTo(0.01 - FIXED_DT);

    // Advance another 0.01s
    advanceAccumulator(acc, 0.01, () => {
      totalSteps++;
    });
    // 0.02s total / (1/120) = 2.4 -> 2 steps total
    expect(totalSteps).toBe(2);
  });

  it('halts stepping immediately if stepFn signals early halt', () => {
    const acc = createAccumulator();
    let stepCount = 0;

    advanceAccumulator(acc, 0.1, () => {
      stepCount++;
      if (stepCount === 3) {
        return true; // Stop early
      }
    });

    expect(stepCount).toBe(3);
    expect(acc.time).toBe(0);
  });

  it('produces identical step counts for sequences [1/60 x 10], [1/30 x 10], and [1.0] (Task 022 Requirement 3)', () => {
    const runSequence = (deltas: number[]): number => {
      const acc = createAccumulator();
      let steps = 0;
      for (const dt of deltas) {
        advanceAccumulator(acc, dt, () => {
          steps++;
        });
      }
      return steps;
    };

    // [1/60 x 10]: 10 frames of 1/60s -> 2 steps per frame = 20 steps
    const seq60 = Array(10).fill(1 / 60);
    expect(runSequence(seq60)).toBe(20);

    // [1/30 x 10]: 10 frames of 1/30s -> 4 steps per frame = 40 steps
    const seq30 = Array(10).fill(1 / 30);
    expect(runSequence(seq30)).toBe(40);

    // [1.0]: 1 frame of 1.0s clamped to 0.25s -> 30 steps
    expect(runSequence([1.0])).toBe(30);
  });

  it('yields at most 30 steps, not 120, for a single 1.0s frame delta (Task 022 Requirement 4)', () => {
    const acc = createAccumulator();
    let steps = 0;
    advanceAccumulator(acc, 1.0, () => {
      steps++;
    });
    expect(steps).toBeLessThanOrEqual(30);
    expect(steps).not.toBe(120);
    expect(steps).toBe(30);
  });

  it('carries over sub-step leftover time across separate advance calls (Task 028 Requirement 1)', () => {
    const acc = createAccumulator();
    let stepCount = 0;

    // First call: 0.005s < FIXED_DT (1/120 ≈ 0.008333s)
    const firstSteps = advanceAccumulator(acc, 0.005, () => {
      stepCount++;
    });
    expect(firstSteps).toBe(0);
    expect(stepCount).toBe(0);

    // Second call: 0.005s. Total accumulated time = 0.010s > FIXED_DT
    const secondSteps = advanceAccumulator(acc, 0.005, () => {
      stepCount++;
    });
    expect(secondSteps).toBe(1);
    expect(stepCount).toBe(1);
    expect(acc.time).toBeCloseTo(0.01 - FIXED_DT);
  });
});

