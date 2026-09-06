export const FIXED_DT = 1 / 120;
export const MAX_ACCUMULATED_TIME = 0.25;

export interface Accumulator {
  time: number;
}

export function createAccumulator(): Accumulator {
  return { time: 0 };
}

export function advanceAccumulator(
  acc: Accumulator,
  frameDeltaSeconds: number,
  stepFn: (dt: number) => boolean | void,
  fixedDt: number = FIXED_DT,
  maxAccumulatedTime: number = MAX_ACCUMULATED_TIME
): number {
  const clampedDelta = Math.min(frameDeltaSeconds, maxAccumulatedTime);
  acc.time += clampedDelta;
  let stepsRun = 0;

  while (acc.time >= fixedDt) {
    acc.time -= fixedDt;
    stepsRun++;
    const shouldHalt = stepFn(fixedDt);
    if (shouldHalt) {
      acc.time = 0;
      break;
    }
  }

  return stepsRun;
}
