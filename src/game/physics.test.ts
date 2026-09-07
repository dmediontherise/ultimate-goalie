import { describe, expect, it } from 'vitest';
import { sweptCircleAABB, sweptCircleCapsule, sweptCircleCircle } from './physics';

describe('Swept Circle vs Circle (Requirement 1, 3)', () => {
  it('detects a direct frontal collision and reports t, point, normal', () => {
    // Circle at (0, 0), radius 10. Moving circle radius 5 moves from (100, 0) to (-100, 0) (dx = 200)
    // Contact at x = 15. Travelled distance = 85. t = 85 / 200 = 0.425
    const hit = sweptCircleCircle({ x: 100, y: 0 }, { x: -100, y: 0 }, 5, { x: 0, y: 0 }, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(0.425, 5);
    expect(hit!.point.x).toBeCloseTo(10, 5);
    expect(hit!.point.y).toBeCloseTo(0, 5);
    expect(hit!.normal.x).toBeCloseTo(1, 5);
    expect(hit!.normal.y).toBeCloseTo(0, 5);
  });

  it('returns null when moving circle passes clear without touching', () => {
    // Circle at (0, 0), radius 10. Moving circle radius 5 travels along y = 20 (closest approach = 20 > 15)
    const hit = sweptCircleCircle({ x: 100, y: 20 }, { x: -100, y: 20 }, 5, { x: 0, y: 0 }, 10);
    expect(hit).toBeNull();
  });

  it('returns t = 0 when moving circle starts already overlapping', () => {
    // Starting at (12, 0), distance = 12 <= 10 + 5 = 15
    const hit = sweptCircleCircle({ x: 12, y: 0 }, { x: -100, y: 0 }, 5, { x: 0, y: 0 }, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBe(0);
    expect(hit!.normal.x).toBeCloseTo(1, 5);
    expect(hit!.point.x).toBeCloseTo(10, 5);
  });

  it('returns null when moving circle travels away from target', () => {
    const hit = sweptCircleCircle({ x: 50, y: 0 }, { x: 100, y: 0 }, 5, { x: 0, y: 0 }, 10);
    expect(hit).toBeNull();
  });
});

describe('Swept Circle vs Capsule (Requirement 2, 3)', () => {
  it('detects collision with capsule side', () => {
    // Vertical capsule from (50, -30) to (50, 30), radius 10.
    // Moving circle radius 5 moves from (150, 0) to (-50, 0) (dx = 200)
    // Contact at x = 50 + (10 + 5) = 65. Travelled distance = 150 - 65 = 85. t = 85 / 200 = 0.425
    const a = { x: 50, y: -30 };
    const b = { x: 50, y: 30 };
    const hit = sweptCircleCapsule({ x: 150, y: 0 }, { x: -50, y: 0 }, 5, a, b, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(0.425, 5);
    expect(hit!.point.x).toBeCloseTo(60, 5);
    expect(hit!.point.y).toBeCloseTo(0, 5);
    expect(hit!.normal.x).toBeCloseTo(1, 5);
    expect(hit!.normal.y).toBeCloseTo(0, 5);
  });

  it('detects collision with capsule end caps', () => {
    const a = { x: 50, y: -30 };
    const b = { x: 50, y: 30 };
    // Moving towards cap B (y = 40)
    const hitB = sweptCircleCapsule({ x: 150, y: 40 }, { x: -50, y: 40 }, 5, a, b, 10);
    expect(hitB).not.toBeNull();
    expect(hitB!.t).toBeGreaterThan(0);
    expect(hitB!.t).toBeLessThan(1);

    // Moving towards cap A (y = -40)
    const hitA = sweptCircleCapsule({ x: 150, y: -40 }, { x: -50, y: -40 }, 5, a, b, 10);
    expect(hitA).not.toBeNull();
    expect(hitA!.t).toBeGreaterThan(0);
    expect(hitA!.t).toBeLessThan(1);
  });

  it('returns null when moving circle misses capsule completely', () => {
    const a = { x: 50, y: -30 };
    const b = { x: 50, y: 30 };
    // Passes far above (y = 100)
    const hit = sweptCircleCapsule({ x: 150, y: 100 }, { x: -50, y: 100 }, 5, a, b, 10);
    expect(hit).toBeNull();
  });

  it('returns t = 0 when moving circle starts inside capsule', () => {
    const a = { x: 50, y: -30 };
    const b = { x: 50, y: 30 };
    // Starts at (55, 0), distance to segment is 5 <= 10 + 5 = 15
    const hit = sweptCircleCapsule({ x: 55, y: 0 }, { x: -50, y: 0 }, 5, a, b, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBe(0);
  });

  it('detects collision with degenerate zero-length capsule (a === b) via fallback (Task 011 Requirement 3)', () => {
    const a = { x: 50, y: 0 };
    const b = { x: 50, y: 0 };
    // Moving from (150, 0) to (-50, 0), radius 5, capsule radius 10.
    // Circle at (50, 0), contact at x = 50 + 15 = 65. dx = 200. t = 85 / 200 = 0.425.
    const hit = sweptCircleCapsule({ x: 150, y: 0 }, { x: -50, y: 0 }, 5, a, b, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(0.425, 5);
    expect(hit!.point.x).toBeCloseTo(60, 5);
    expect(hit!.point.y).toBeCloseTo(0, 5);
  });
});

describe('Swept Circle vs AABB', () => {
  it('detects collision with box boundary', () => {
    const hit = sweptCircleAABB({ x: 200, y: 0 }, { x: -100, y: 0 }, 5, -20, 20, -20, 20);
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(20, 5);
    expect(hit!.point.y).toBeCloseTo(0, 5);
  });
});
