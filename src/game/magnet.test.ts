import { describe, expect, it } from 'vitest';
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

    // Case A: Outside radius (distance 300 > radius 250)
    const puckOutsideRadius = {
      pos: { x: 400, y: 300 },
      vel: { ...vel },
    };
    const velAfterA = applyMagnet(puckOutsideRadius, goalie, magnet, dt);
    expect(velAfterA.x).toBe(vel.x);
    expect(velAfterA.y).toBe(vel.y);

    // Near-boundary inside radius (distance 240 < 250): must be in field and deflected
    const puckInsideRadius = {
      pos: { x: 340, y: 300 },
      vel: { ...vel },
    };
    expect(isInMagnetField(puckInsideRadius.pos, goalie.pos)).toBe(true);
    const velInside = applyMagnet(puckInsideRadius, goalie, magnet, dt);
    expect(Math.hypot(velInside.x - vel.x, velInside.y - vel.y)).toBeGreaterThan(0);

    // Boundary at exactly distance 250: in field, zero force due to linear falloff
    expect(isInMagnetField({ x: 350, y: 300 }, goalie.pos)).toBe(true);
    const velBoundary = applyMagnet({ pos: { x: 350, y: 300 }, vel: { ...vel } }, goalie, magnet, dt);
    expect(velBoundary).toEqual(vel);

    // Just beyond boundary at distance 251: outside field
    expect(isInMagnetField({ x: 351, y: 300 }, goalie.pos)).toBe(false);
    const velPastBoundary = applyMagnet({ pos: { x: 351, y: 300 }, vel: { ...vel } }, goalie, magnet, dt);
    expect(velPastBoundary).toEqual(vel);

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

  it('accepts pucks at cone angles between 45 and 60 degrees and rejects beyond 60 degrees (Task 023 Requirement 5)', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const dt = 1 / 60;
    const dist = 120;

    // Angle 50° is strictly between 45° (PI/4 ≈ 0.785) and 60° (PI/3 ≈ 1.047)
    const angle50 = (50 * Math.PI) / 180;
    const puckUpper = {
      pos: { x: 100 + dist * Math.cos(angle50), y: 300 + dist * Math.sin(angle50) },
      vel: { x: -300, y: 0 },
    };
    expect(isInMagnetField(puckUpper.pos, goalie.pos)).toBe(true);
    const velUpper = applyMagnet(puckUpper, goalie, magnet, dt);
    expect(velUpper.y).not.toBe(0);
    expect(Math.hypot(velUpper.x - puckUpper.vel.x, velUpper.y - puckUpper.vel.y)).toBeGreaterThan(0);

    // Negative angle -50°
    const angleNeg50 = (-50 * Math.PI) / 180;
    const puckLower = {
      pos: { x: 100 + dist * Math.cos(angleNeg50), y: 300 + dist * Math.sin(angleNeg50) },
      vel: { x: -300, y: 0 },
    };
    expect(isInMagnetField(puckLower.pos, goalie.pos)).toBe(true);
    const velLower = applyMagnet(puckLower, goalie, magnet, dt);
    expect(velLower.y).not.toBe(0);
    expect(Math.hypot(velLower.x - puckLower.vel.x, velLower.y - puckLower.vel.y)).toBeGreaterThan(0);

    // Angle 65° is outside 60° cone (PI/3)
    const angle65 = (65 * Math.PI) / 180;
    const puckOutside = {
      pos: { x: 100 + dist * Math.cos(angle65), y: 300 + dist * Math.sin(angle65) },
      vel: { x: -300, y: 0 },
    };
    expect(isInMagnetField(puckOutside.pos, goalie.pos)).toBe(false);
    const velOutside = applyMagnet(puckOutside, goalie, magnet, dt);
    expect(velOutside).toEqual(puckOutside.vel);
  });

  // Requirement 4: Smooth monotonic falloff across at least 10 sample distances and zero at boundary
  it('decreases applied force monotonically across 10 sample distances with no discontinuity at boundary', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const vel = { x: -300, y: 100 };
    const dt = 1 / 60;

    // Sample distances inside the field radius up to near-boundary
    const sampleDistances = [15, 35, 55, 75, 95, 115, 135, 155, 175, 195, 215, 235, 245];
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

    // Assert no discontinuity at field boundary: change at exactly distance 250 is 0
    const puckAtBoundary = {
      pos: { x: 350, y: 300 },
      vel: { ...vel },
    };
    const boundaryVel = applyMagnet(puckAtBoundary, goalie, magnet, dt);
    const boundaryChange = Math.hypot(boundaryVel.x - vel.x, boundaryVel.y - vel.y);
    expect(boundaryChange).toBe(0);
  });

  it('applies linear falloff across distance distinguishing from quadratic curves (Task 023 Requirement 6)', () => {
    const goalie = { pos: { x: 100, y: 300 } };
    const magnet = { charge: 1, active: true };
    const dt = 1 / 60;
    const vel = { x: -300, y: 100 };

    const getTurnAngle = (dist: number): number => {
      const puck = {
        pos: { x: 100 + dist, y: 300 },
        vel: { ...vel },
      };
      const newVel = applyMagnet(puck, goalie, magnet, dt);
      const originalAngle = Math.atan2(vel.y, vel.x);
      const turnedAngle = Math.atan2(newVel.y, newVel.x);
      return Math.abs(turnedAngle - originalAngle);
    };

    const t50 = getTurnAngle(50);
    const t100 = getTurnAngle(100);
    const t150 = getTurnAngle(150);
    const t200 = getTurnAngle(200);
    const t125 = getTurnAngle(125); // exactly half of R=250

    // Constant first difference across equally-spaced intervals (linear slope)
    const diff1 = t50 - t100;
    const diff2 = t100 - t150;
    const diff3 = t150 - t200;
    expect(diff1).toBeCloseTo(diff2, 5);
    expect(diff2).toBeCloseTo(diff3, 5);

    // Midpoint at d = 125 (half of 250) yields exactly 50% of maximum steering
    // maxTurn at d=0 is 4.0 * (1/60) ≈ 0.066667 rad; at d=125 it is 0.5 * (4.0 / 60) ≈ 0.033333 rad
    const maxTurnAtZero = 4.0 * dt;
    expect(t125).toBeCloseTo(0.5 * maxTurnAtZero, 5);
    expect(t125).toBeCloseTo((t50 + t200) / 2, 5);

    // Quadratic falloff (1 - d/R)^2 would give 0.25 at midpoint; 1 - (d/R)^2 would give 0.75
    expect(Math.abs(t125 - 0.25 * maxTurnAtZero)).toBeGreaterThan(0.01);
    expect(Math.abs(t125 - 0.75 * maxTurnAtZero)).toBeGreaterThan(0.01);
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

    // Drain rate is 0.4/s. After 0.5s of continuous use, charge is exactly 0.80 (not computed from constant)
    const dt = 0.5;
    stepMagnet(magnet, true, dt);
    expect(magnet.active).toBe(true);
    expect(magnet.charge).toBeCloseTo(0.80, 5);

    // Full exhaustion from 1.0 at 0.4/s takes exactly 2.5s (4 more 0.5s steps)
    stepMagnet(magnet, true, dt);
    expect(magnet.charge).toBeCloseTo(0.60, 5);
    stepMagnet(magnet, true, dt);
    expect(magnet.charge).toBeCloseTo(0.40, 5);
    stepMagnet(magnet, true, dt);
    expect(magnet.charge).toBeCloseTo(0.20, 5);
    stepMagnet(magnet, true, dt);
    expect(magnet.charge).toBeCloseTo(0, 5);
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

    // Regenerate charge when not held: regen rate is 0.2/s. After 0.5s idle, charge is exactly 0.10 (not computed from constant)
    stepMagnet(magnet, false, dt);
    expect(magnet.active).toBe(false);
    expect(magnet.charge).toBeCloseTo(0.10, 5);

    // 2.5s total idle reaches 0.50 (4 more 0.5s steps)
    for (let i = 0; i < 4; i++) {
      stepMagnet(magnet, false, dt);
    }
    expect(magnet.charge).toBeCloseTo(0.50, 5);

    // Full restoration from 0 to 1.0 takes exactly 5.0s (5 more 0.5s steps = 10 total)
    for (let i = 0; i < 5; i++) {
      stepMagnet(magnet, false, dt);
    }
    expect(magnet.charge).toBeCloseTo(1.0, 5);

    // Regen caps at 1.0
    for (let i = 0; i < 10; i++) {
      stepMagnet(magnet, false, dt);
    }
    expect(magnet.charge).toBe(1.0);
  });
});
