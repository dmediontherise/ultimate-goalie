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

    const mockCtx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
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
});
