// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameCanvas from './GameCanvas';
import * as simModule from '../game/sim';
import { RoundConfig } from '../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('GameCanvas loop dependency regression (Task 009)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let nextRafId = 1;
  let cancelAnimSpy: any;
  let requestAnimSpy: any;

  const initialConfig: RoundConfig = {
    roundNumber: 1,
    shooterSpeed: 4,
    shotSpeed: 10,
    aiIntelligence: 0.5,
    curveFactor: 0,
    jitter: 0,
    isSlapShot: false,
    hasPowerUp: false,
    hasMagnet: false,
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    nextRafId = 1;

    requestAnimSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => nextRafId++);
    cancelAnimSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const mockGradient = {
      addColorStop: vi.fn(),
    };

    const mockCtx = {
      beginPath: vi.fn(),
      quadraticCurveTo: vi.fn(),
      clip: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      closePath: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      createLinearGradient: vi.fn(() => mockGradient),
      createRadialGradient: vi.fn(() => mockGradient),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
    } as unknown as CanvasRenderingContext2D;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('changing onRoundEnd prop does not tear down and recreate running simulation', () => {
    const onRoundEnd1 = vi.fn();
    const onRoundEnd2 = vi.fn();
    const createSimSpy = vi.spyOn(simModule, 'createSim');

    // Initial mount
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd1}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const callsAfterMount = createSimSpy.mock.calls.length;
    expect(callsAfterMount).toBe(2);
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimSpy).not.toHaveBeenCalled();

    // Re-render with new onRoundEnd, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd2}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    // Effect must not have cleaned up or torn down the loop
    expect(cancelAnimSpy).not.toHaveBeenCalled();
    // Effect must not have re-registered another animation frame
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    // Simulation must not have been recreated by the effect:
    // exactly one call occurs from component render body, zero from effect
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 1);
  });

  it('changing onHudUpdate prop does not tear down and recreate running simulation', () => {
    const onRoundEnd = vi.fn();
    const onHudUpdate1 = vi.fn();
    const onHudUpdate2 = vi.fn();
    const createSimSpy = vi.spyOn(simModule, 'createSim');

    // Initial mount
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
          onHudUpdate={onHudUpdate1}
        />
      );
    });

    const callsAfterMount = createSimSpy.mock.calls.length;
    expect(callsAfterMount).toBe(2);
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimSpy).not.toHaveBeenCalled();

    // Re-render with new onHudUpdate, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
          onHudUpdate={onHudUpdate2}
        />
      );
    });

    // Effect must not have cleaned up or torn down the loop
    expect(cancelAnimSpy).not.toHaveBeenCalled();
    // Effect must not have re-registered another animation frame
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    // Simulation must not have been recreated by the effect:
    // exactly one call occurs from component render body, zero from effect
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 1);
  });

  it('toggling hatTrickActive prop does not tear down and recreate running simulation', () => {
    const onRoundEnd = vi.fn();
    const createSimSpy = vi.spyOn(simModule, 'createSim');

    // Initial mount
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const callsAfterMount = createSimSpy.mock.calls.length;
    expect(callsAfterMount).toBe(2);
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimSpy).not.toHaveBeenCalled();

    // Re-render with hatTrickActive toggled to true, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={true}
          octopusActive={false}
        />
      );
    });

    // Effect must not have cleaned up or torn down the loop
    expect(cancelAnimSpy).not.toHaveBeenCalled();
    // Effect must not have re-registered another animation frame
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    // Simulation must not have been recreated by the effect:
    // exactly one call occurs from component render body, zero from effect
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 1);

    // Re-render with hatTrickActive toggled back to false, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    expect(cancelAnimSpy).not.toHaveBeenCalled();
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 2);
  });

  it('toggling octopusActive prop does not tear down and recreate running simulation (Task 018 Requirement 1)', () => {
    const onRoundEnd = vi.fn();
    const createSimSpy = vi.spyOn(simModule, 'createSim');

    // Initial mount
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const callsAfterMount = createSimSpy.mock.calls.length;
    expect(callsAfterMount).toBe(2);
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimSpy).not.toHaveBeenCalled();

    // Re-render with octopusActive toggled to true, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={true}
        />
      );
    });

    // Effect must not have cleaned up or torn down the loop
    expect(cancelAnimSpy).not.toHaveBeenCalled();
    // Effect must not have re-registered another animation frame
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    // Simulation must not have been recreated by the effect:
    // exactly one call occurs from component render body, zero from effect
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 1);

    // Re-render with octopusActive toggled back to false, roundConfig held constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    expect(cancelAnimSpy).not.toHaveBeenCalled();
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 2);
  });

  it('invoking animation frame uses the updated onHudUpdate callback after re-render (Task 018 Requirement 2)', () => {
    const onRoundEnd = vi.fn();
    const onHudUpdate1 = vi.fn();
    const onHudUpdate2 = vi.fn();

    // Initial mount with onHudUpdate1
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
          onHudUpdate={onHudUpdate1}
        />
      );
    });

    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    const frameCallback = requestAnimSpy.mock.calls[0][0];

    // Re-render with onHudUpdate2
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
          onHudUpdate={onHudUpdate2}
        />
      );
    });

    // Drive one animation frame
    act(() => {
      frameCallback(performance.now() + 16);
    });

    expect(onHudUpdate1).not.toHaveBeenCalled();
    expect(onHudUpdate2).toHaveBeenCalledTimes(1);
  });

  it('invoking animation frame uses the updated onRoundEnd callback when round ends after re-render (Task 025 Requirements 1, 2)', () => {
    const onRoundEnd1 = vi.fn();
    const onRoundEnd2 = vi.fn();

    // Configure createSim to produce a sim where puck enters goal mouth across the goal line
    const realCreateSim = simModule.createSim;
    vi.spyOn(simModule, 'createSim').mockImplementation((config, seed) => {
      const sim = realCreateSim(config, seed);
      sim.hasShot = true;
      sim.goaliePos = { x: 100, y: 100 };
      sim.puckPos = { x: 40, y: 300 };
      sim.puckVel = { x: -100, y: 0 };
      return sim;
    });

    // Initial mount with onRoundEnd1
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd1}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    const frameCallback = requestAnimSpy.mock.calls[0][0];

    // Re-render with onRoundEnd2, holding roundConfig constant
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd2}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    // Drive one animation frame (step runs, detects goal scored, triggers round-end)
    act(() => {
      frameCallback(performance.now() + 16);
    });

    // The updated onRoundEnd2 must be invoked with round result, not the stale onRoundEnd1
    expect(onRoundEnd1).not.toHaveBeenCalled();
    expect(onRoundEnd2).toHaveBeenCalledTimes(1);
    expect(onRoundEnd2).toHaveBeenCalledWith(false, undefined);
  });

  it('changing roundConfig prop causes the loop to reset and recreate simulation', () => {
    const onRoundEnd = vi.fn();
    const createSimSpy = vi.spyOn(simModule, 'createSim');

    // Initial mount
    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const callsAfterMount = createSimSpy.mock.calls.length;
    expect(callsAfterMount).toBe(2);
    expect(requestAnimSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimSpy).not.toHaveBeenCalled();

    // Re-render with updated roundConfig
    const updatedConfig: RoundConfig = {
      ...initialConfig,
      roundNumber: 2,
    };

    act(() => {
      root.render(
        <GameCanvas
          roundConfig={updatedConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    // Effect must have torn down previous loop
    expect(cancelAnimSpy).toHaveBeenCalledTimes(1);
    // Loop must have registered a new animation frame
    expect(requestAnimSpy).toHaveBeenCalledTimes(2);
    // Simulation recreated in effect (calls increase by 2: render body + effect re-init)
    expect(createSimSpy).toHaveBeenCalledTimes(callsAfterMount + 2);
  });

  it('clamps a 1.0s frame delta to at most 30 sim steps in running GameCanvas loop (Task 022 Requirement 4)', () => {
    const onRoundEnd = vi.fn();
    const stepSpy = vi.spyOn(simModule, 'step');

    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const frameCallback = requestAnimSpy.mock.calls[0][0];
    stepSpy.mockClear();

    // Drive one frame with a 1.0s delta (background tab catchup)
    act(() => {
      frameCallback(performance.now() + 1000);
    });

    // Clamp limits 1.0s to 0.25s: 0.25 / (1/120) = 30 steps max, not 120
    expect(stepSpy).toHaveBeenCalledTimes(30);
    expect(stepSpy.mock.calls.length).toBeLessThanOrEqual(30);
    expect(stepSpy.mock.calls.length).not.toBe(120);
  });

  it('persists accumulator across animation frames rather than recreating per frame (Task 028 Requirement 2)', () => {
    const onRoundEnd = vi.fn();
    const stepSpy = vi.spyOn(simModule, 'step');
    let fakeNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);

    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const frameCallback = requestAnimSpy.mock.calls[0][0];
    stepSpy.mockClear();

    // Drive frame 1: delta 5ms (0.005s), less than FIXED_DT (1/120s ≈ 8.33ms)
    fakeNow += 5;
    act(() => {
      frameCallback(fakeNow);
    });
    expect(stepSpy).not.toHaveBeenCalled();

    // Drive frame 2: delta 5ms (0.005s), cumulative 10ms > FIXED_DT
    fakeNow += 5;
    act(() => {
      frameCallback(fakeNow);
    });
    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(stepSpy.mock.calls[0][2]).toBe(1 / 120);
  });

  it('halts stepping on round-end event rather than continuing to drain accumulator (Task 028 Requirement 3)', () => {
    const onRoundEnd = vi.fn();
    const roundEndEvent: simModule.SimEvent = {
      type: 'round-end',
      success: true,
      saveType: 'glove',
    };
    const stepSpy = vi.spyOn(simModule, 'step').mockReturnValue([roundEndEvent]);
    let fakeNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);

    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const frameCallback = requestAnimSpy.mock.calls[0][0];
    stepSpy.mockClear();

    // Drive frame with 50ms delta (0.05s / (1/120s) = 6 fixed steps)
    fakeNow += 50;
    act(() => {
      frameCallback(fakeNow);
    });

    // Halts immediately after the first step produces round-end
    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(stepSpy.mock.calls.length).toBeLessThan(6);
  });

  it('invokes sim.step with fixed dt of 1/120 (Task 028 Requirement 4)', () => {
    const onRoundEnd = vi.fn();
    const stepSpy = vi.spyOn(simModule, 'step');
    let fakeNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);

    act(() => {
      root.render(
        <GameCanvas
          roundConfig={initialConfig}
          onRoundEnd={onRoundEnd}
          hatTrickActive={false}
          octopusActive={false}
        />
      );
    });

    const frameCallback = requestAnimSpy.mock.calls[0][0];
    stepSpy.mockClear();

    // Drive one frame with 16ms delta (0.016s >= 1/120s)
    fakeNow += 16;
    act(() => {
      frameCallback(fakeNow);
    });

    expect(stepSpy).toHaveBeenCalled();
    expect(stepSpy.mock.calls[0][2]).toBe(1 / 120);
    expect(stepSpy).toHaveBeenCalledWith(expect.anything(), expect.anything(), 1 / 120);
  });
});

