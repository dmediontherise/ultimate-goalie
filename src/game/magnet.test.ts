import { describe, expect, it } from 'vitest';
import {
  MAGNET_CONE_HALF_ANGLE,
  MAGNET_DRAIN_RATE,
  MAGNET_MAX_STEER_RATE,
  MAGNET_RADIUS,
  MAGNET_REGEN_RATE,
} from './constants';
import {
  applyMagnet,
  createMagnet,
  isInMagnetField,
  stepMagnet,
} from './magnet';

describe('Magnet System (Task 004)', () => {
  // Requirement 1 & Purity
  it('is a pure function that does not mutate inputs or reference globals', () => {
    const puck = { pos: { x: 200, y: 310 }, vel: { x: -300, y: 50 } };
    const puckPosBefore = { ...puck.pos };
    const puckVelBefore = { ...puck.vel };
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };

    const newVel = applyMagnet(puck, goalie, magnet, 1 / 60);

    // Assert inputs were not mutated
    expect(puck.pos).toEqual(puckPosBefore);
    expect(puck.vel).toEqual(puckVelBefore);
    expect(Number.isFinite(newVel.x)).toBe(true);
    expect(Number.isFinite(newVel.y)).toBe(true);
  });

  // Requirement 2: Head-on cone approach from shooter side & old gate failure
  it('confirms head-on approach from shooter is inside field and fails old buggy gate', () => {
    const goaliePos = { x: 100, y: 300 };
    const puckPos = { x: 200, y: 300 };

    // 1. The old buggy code from background:
    // const angle = Math.atan2(goalie.y - puck.y, goalie.x - puck.x);
    // if (dist < 100 && (angle > -Math.PI * 0.75 && angle < Math.PI * 0.75))
    const dxOld = goaliePos.x - puckPos.x;
    const dyOld = goaliePos.y - puckPos.y;
    const distOld = Math.hypot(dxOld, dyOld);
    const angleOld = Math.atan2(dyOld, dxOld);
    const oldGatePasses =
      distOld < 100 &&
      angleOld > -Math.PI * 0.75 &&
      angleOld < Math.PI * 0.75;

    // Must fail against old gate
    expect(oldGatePasses).toBe(false);

    // 2. New cone gate opening toward shooter (+x):
    expect(isInMagnetField(puckPos, goaliePos)).toBe(true);
  });

  // Requirement 3: Puck outside radius and outside cone half-angle receive zero change
  it('gives zero change to pucks outside radius or outside cone half-angle', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const vel = { x: -300, y: 50 };
    const dt = 1 / 60;

    // Case A: Outside radius
    const puckOutsideRadius = {
      pos: { x: 100 + MAGNET_RADIUS + 50, y: 300 },
      vel: { ...vel },
    };
    const velAfterA = applyMagnet(puckOutsideRadius, goalie, magnet, dt);
    expect(velAfterA.x).toBe(vel.x);
    expect(velAfterA.y).toBe(vel.y);

    // Case B: Inside radius, but behind goalie (outside cone half-angle)
    const puckBehindGoalie = {
      pos: { x: 50, y: 300 },
      vel: { ...vel },
    };
    const velAfterB = applyMagnet(puckBehindGoalie, goalie, magnet, dt);
    expect(velAfterB.x).toBe(vel.x);
    expect(velAfterB.y).toBe(vel.y);

    // Case C: Inside radius, but perpendicular to goalie (outside cone half-angle)
    const puckPerpendicular = {
      pos: { x: 100, y: 400 },
      vel: { ...vel },
    };
    const velAfterC = applyMagnet(puckPerpendicular, goalie, magnet, dt);
    expect(velAfterC.x).toBe(vel.x);
    expect(velAfterC.y).toBe(vel.y);
  });

  // Requirement 4: Smooth monotonic falloff across at least 10 sample distances and zero at boundary
  it('decreases applied force monotonically across 10 sample distances with no discontinuity at boundary', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const vel = { x: -300, y: 100 };
    const dt = 1 / 60;

    // Sample 10 distances inside the field radius
    const sampleDistances = [15, 35, 55, 75, 95, 115, 135, 155, 175, 195, 215];
    expect(sampleDistances.length).toBeGreaterThanOrEqual(10);

    const changes: number[] = [];
    for (const d of sampleDistances) {
      const puck = {
        pos: { x: 100 + d, y: 300 },
        vel: { ...vel },
      };
      const newVel = applyMagnet(puck, goalie, magnet, dt);
      const deltaMag = Math.hypot(newVel.x - vel.x, newVel.y - vel.y);
      changes.push(deltaMag);
    }

    // Assert strictly monotonic decrease across all sample distances
    for (let i = 0; i < changes.length - 1; i++) {
      expect(changes[i]).toBeGreaterThan(changes[i + 1]);
    }

    // Assert no discontinuity at field boundary: change at exactly MAGNET_RADIUS is 0
    const puckAtBoundary = {
      pos: { x: 100 + MAGNET_RADIUS, y: 300 },
      vel: { ...vel },
    };
    const boundaryVel = applyMagnet(puckAtBoundary, goalie, magnet, dt);
    const boundaryChange = Math.hypot(boundaryVel.x - vel.x, boundaryVel.y - vel.y);
    expect(boundaryChange).toBe(0);
  });

  // Requirement 5: Steers without changing speed (within 0.01 px/s) at several distances and angles
  it('steers puck velocity toward goalie while strictly conserving speed within 0.01 px/s', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const dt = 1 / 60;

    const testDistances = [30, 70, 120, 180, 230];
    const testAngles = [-0.5, -0.25, 0.05, 0.2, 0.45];
    const testSpeeds = [200, 500, 800, 1200];

    for (const d of testDistances) {
      for (const angle of testAngles) {
        for (const speed of testSpeeds) {
          // Puck velocity approaching from the right at an angle
          const vel = {
            x: -speed * Math.cos(angle),
            y: speed * Math.sin(angle),
          };
          const speedBefore = Math.hypot(vel.x, vel.y);

          const puck = {
            pos: { x: 100 + d, y: 300 },
            vel,
          };

          const newVel = applyMagnet(puck, goalie, magnet, dt);
          const speedAfter = Math.hypot(newVel.x, newVel.y);

          expect(Math.abs(speedAfter - speedBefore)).toBeLessThan(0.01);
        }
      }
    }
  });

  // Requirement 7: Charge in [0, 1], drains while held, regenerates when not, 0 force at zero charge
  it('drains charge while held, regenerates when idle, and applies zero force when exhausted', () => {
    const magnet = createMagnet();
    expect(magnet.charge).toBe(1);

    // Drain charge over time
    const dt = 0.5;
    stepMagnet(magnet, true, dt);
    expect(magnet.active).toBe(true);
    expect(magnet.charge).toBeCloseTo(1 - MAGNET_DRAIN_RATE * dt, 5);

    // Continue draining until completely exhausted
    while (magnet.charge > 0) {
      stepMagnet(magnet, true, dt);
    }
    expect(magnet.charge).toBe(0);

    // Assert force is zero once charge is exhausted
    const goalie = { pos: { x: 100, y: 300 } };
    const puck = { pos: { x: 180, y: 320 }, vel: { x: -300, y: 50 } };
    const newVel = applyMagnet(puck, goalie, magnet, 1 / 60);
    const forceMag = Math.hypot(newVel.x - puck.vel.x, newVel.y - puck.vel.y);
    expect(forceMag).toBe(0);

    // Regenerate charge when not held
    stepMagnet(magnet, false, dt);
    expect(magnet.active).toBe(false);
    expect(magnet.charge).toBeCloseTo(MAGNET_REGEN_RATE * dt, 5);

    // Regen caps at 1.0
    for (let i = 0; i < 20; i++) {
      stepMagnet(magnet, false, dt);
    }
    expect(magnet.charge).toBe(1);
  });
});
