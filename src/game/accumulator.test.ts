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
});
