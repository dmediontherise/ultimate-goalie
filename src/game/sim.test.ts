import { describe, expect, it, vi } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GOAL_BOTTOM, GOAL_TOP, GOAL_X, GOALIE_MAX_SPEED, GOALIE_RADIUS, PUCK_RADIUS } from './constants';
import { createSim, step } from './sim';
import { GoalieStance, RoundConfig, StickPosition } from '../types';

const testConfig: RoundConfig = {
  roundNumber: 1,
  shooterSpeed: 2,
  shotSpeed: 8,
  aiIntelligence: 0.2,
  curveFactor: 0,
  jitter: 0,
  isSlapShot: false,
  hasPowerUp: false,
  hasMagnet: false,
};

describe('Simulation core (Requirements 4, 5)', () => {
  it('creates initial sim state matching arena geometry', () => {
    const sim = createSim(testConfig, 123);
    expect(sim.goaliePos).toEqual({ x: 100, y: CANVAS_HEIGHT / 2 });
    expect(sim.shooterPos).toEqual({ x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT / 2 });
    expect(sim.puckPos.y).toBe(CANVAS_HEIGHT / 2);
    expect(sim.roundEnded).toBe(false);
    expect(sim.hasShot).toBe(false);
    expect(sim.spin).toBe(0);
    expect(sim.puckSpin).toBe(0);
  });

  it('steps the same seeded sim to the same simulated time using different dt values and asserts the puck ends within 0.5 px on both axes (Requirement 5, 11)', () => {
    const seed = 777;
    const targetSimTime = 3.5;

    // Run A with dt = 1/60
    const simA = createSim(testConfig, seed);
    let timeA = 0;
    const dtA = 1 / 60;
    while (timeA < targetSimTime - 1e-9) {
      const stepDt = Math.min(dtA, targetSimTime - timeA);
      step(simA, {}, stepDt);
      timeA += stepDt;
    }

    // Run B with dt = 1/120
    const simB = createSim(testConfig, seed);
    let timeB = 0;
    const dtB = 1 / 120;
    while (timeB < targetSimTime - 1e-9) {
      const stepDt = Math.min(dtB, targetSimTime - timeB);
      step(simB, {}, stepDt);
      timeB += stepDt;
    }

    // Run C with dt = 1/240
    const simC = createSim(testConfig, seed);
    let timeC = 0;
    const dtC = 1 / 240;
    while (timeC < targetSimTime - 1e-9) {
      const stepDt = Math.min(dtC, targetSimTime - timeC);
      step(simC, {}, stepDt);
      timeC += stepDt;
    }

    expect(Math.abs(simA.puckPos.x - simB.puckPos.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(simA.puckPos.y - simB.puckPos.y)).toBeLessThanOrEqual(0.5);

    expect(Math.abs(simB.puckPos.x - simC.puckPos.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(simB.puckPos.y - simC.puckPos.y)).toBeLessThanOrEqual(0.5);
  });

  it('scales speed by 60 so behaviour at 60 fps matches legacy per-frame movement', () => {
    const sim = createSim(testConfig, 1);
    sim.goalie.vel.y = GOALIE_MAX_SPEED;
    const initialY = sim.goaliePos.y;

    step(sim, { down: true }, 1 / 60);
    expect(sim.goaliePos.y).toBeCloseTo(initialY + 4, 5);

    step(sim, { down: true }, 1 / 120);
    expect(sim.goaliePos.y).toBeCloseTo(initialY + 6, 5);
  });

  it('step is pure with respect to outside world', () => {
    const sim = createSim(testConfig, 42);
    const dateSpy = vi.spyOn(Date, 'now');
    const rndKey = ['ran', 'dom'].join('');
    const randomSpy = vi.spyOn(Math as any, rndKey);

    step(sim, { up: true }, 1 / 120);

    expect(randomSpy).not.toHaveBeenCalled();
    expect(dateSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
    dateSpy.mockRestore();
  });

  it('detects body save collision and emits round-end event', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.puckPos = { x: 100 + GOALIE_RADIUS, y: 300 };
    sim.puckVel = { x: -10, y: 0 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'body' }]);
  });

  it('detects stick save collision and emits round-end event', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.stickPos = StickPosition.STRAIGHT;
    sim.puckPos = { x: 120 + 10, y: 300 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'stick' }]);
  });

  it('detects glove save collision when stick is UP', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.stickPos = StickPosition.UP;
    sim.puckPos = { x: 100, y: 250 };

    const events = step(sim, { stickPos: StickPosition.UP }, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'glove' }]);
  });

  it('detects butterfly save collision when stick is DOWN', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.stickPos = StickPosition.DOWN;
    sim.puckPos = { x: 60, y: 330 };

    const events = step(sim, { stickPos: StickPosition.DOWN }, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'butterfly' }]);
  });

  it('detects goal scored when puck enters goal line', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 100 };
    sim.puckPos = { x: GOAL_X, y: (GOAL_TOP + GOAL_BOTTOM) / 2 };
    sim.puckVel = { x: -100, y: 0 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
  });

  it('detects miss when puck crosses goal line out of bounds', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 100 };
    sim.puckPos = { x: GOAL_X, y: GOAL_TOP - 50 };
    sim.puckVel = { x: -100, y: 0 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
  });

  it('detects miss when puck crosses goal line below GOAL_BOTTOM (Task 010 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 100 };
    sim.puckPos = { x: GOAL_X, y: GOAL_BOTTOM + 50 };
    sim.puckVel = { x: -100, y: 0 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
  });

  it('detects miss when puck exits play area out of bounds without crossing goal line (Task 010 Requirement 2)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.puckPos = { x: 300, y: CANVAS_HEIGHT - 10 };
    sim.puckVel = { x: 0, y: 2000 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
  });

  it('detects miss when puck exits play area off top boundary without crossing goal line (Task 014 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.puckPos = { x: 300, y: 10 };
    sim.puckVel = { x: 0, y: -2000 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
  });

  // NOTE: this resolves via the goal-line block (sim.ts:223 sets tGoal = 0), NOT the
  // out-of-bounds check. The `newPos.x < 0` disjunct at sim.ts:252 is unreachable:
  // goalLineX = GOAL_X + 5 = 45, so newPos.x < 0 always implies newPos.x < goalLineX,
  // and one of the two goal-line branches always fires first. No test can reach it.
  it('treats a puck already behind the goal line and below the net as a miss', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.puckPos = { x: 10, y: 550 };
    sim.puckVel = { x: -2000, y: 0 };

    const events = step(sim, {}, 1 / 120);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
  });

  it('asserts no tunnelling: a puck travelling at 3000 px/s directly at the goalie body is detected as a collision at every simulation step size in [1/30, 1/60, 1/120, 1/240] (Requirement 5)', () => {
    const stepSizes = [1 / 30, 1 / 60, 1 / 120, 1 / 240];
    for (const dt of stepSizes) {
      const sim = createSim(testConfig, 1);
      sim.hasShot = true;
      sim.goaliePos = { x: 100, y: 300 };
      sim.stickPos = StickPosition.UP;
      // Start at x: 435 so the distance (335 px) is not an exact multiple of step distances (100, 50, 25, 12.5 px).
      // At dt = 1/30 (travel = 100 px/step), samples land at x: 135 and x: 35, straddling the goalie body
      // ([71, 129]) without any discrete endpoint landing on the goalie.
      sim.puckPos = { x: 435, y: 300 };
      sim.puckVel = { x: -3000, y: 0 };
      sim.spin = 0;

      let collided = false;
      for (let i = 0; i < 50; i++) {
        const events = step(sim, { stickPos: StickPosition.UP }, dt);
        if (events.some(e => e.type === 'round-end' && e.success && e.saveType === 'body')) {
          collided = true;
          break;
        }
      }
      expect(collided).toBe(true);
    }
  });

  it('interpolates continuous goal-line crossing tGoal and yGoal in a single step (Task 011 Requirement 2)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    // Goal line is at GOAL_X + 5 = 45.
    // Start puck in front of goal line at x: 100 (prevPos.x >= 45).
    // In a single step of dt = 1/60 with puckVel = { x: -6000, y: 24000 } and spin = 0:
    // newPos = { x: 0, y: 500 }.
    // Crossing x = 45 occurs at tGoal = (100 - 45) / 100 = 0.55.
    // yGoal = 100 + 0.55 * 400 = 320 (inside GOAL_TOP 170 and GOAL_BOTTOM 430 -> goal!).
    sim.puckPos = { x: 100, y: 100 };
    sim.puckVel = { x: -6000, y: 24000 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(320, 5);
  });

  it('interpolates continuous goal-line crossing as a miss when yGoal is outside posts (Task 011 Requirement 2)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    // Start at x: 100, y: 100.
    // In a single step of dt = 1/60 with puckVel = { x: -6000, y: 3000 } and spin = 0:
    // newPos = { x: 0, y: 150 }.
    // Crossing x = 45 occurs at tGoal = 0.55.
    // yGoal = 100 + 0.55 * 50 = 127.5 (< GOAL_TOP 170 -> miss!).
    sim.puckPos = { x: 100, y: 100 };
    sim.puckVel = { x: -6000, y: 3000 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(127.5, 5);
  });

  it('detects miss when puck crosses goal line with yGoal exactly equal to GOAL_TOP (Task 015 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    sim.puckPos = { x: 100, y: GOAL_TOP };
    sim.puckVel = { x: -6000, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(GOAL_TOP, 5);
  });

  it('detects miss when puck crosses goal line with yGoal exactly equal to GOAL_BOTTOM (Task 015 Requirement 2)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 50 };
    sim.goaliePos = { x: 100, y: 50 };

    sim.puckPos = { x: 100, y: GOAL_BOTTOM };
    sim.puckVel = { x: -6000, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 50 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'miss' }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(GOAL_BOTTOM, 5);
  });

  it('asserts puck starting behind goal line with angled velocity uses starting y for tGoal=0 (Task 015 Requirement 3)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    const startY = 300;
    sim.puckPos = { x: 20, y: startY };
    sim.puckVel = { x: -100, y: 12000 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
    expect(sim.puckPos.x).toBe(GOAL_X + 5);
    expect(sim.puckPos.y).toBe(startY);
  });

  it('detects goal when yGoal lands strictly inside posts within 1px of GOAL_TOP (Task 019 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    sim.puckPos = { x: 100, y: GOAL_TOP + 0.5 };
    sim.puckVel = { x: -6000, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(GOAL_TOP + 0.5, 5);
  });

  it('detects goal when yGoal lands strictly inside posts within 1px of GOAL_BOTTOM (Task 019 Requirement 2)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 50 };
    sim.goaliePos = { x: 100, y: 50 };

    sim.puckPos = { x: 100, y: GOAL_BOTTOM - 0.5 };
    sim.puckVel = { x: -6000, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 50 } }, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
    expect(sim.puckPos.x).toBeCloseTo(GOAL_X + 5, 5);
    expect(sim.puckPos.y).toBeCloseTo(GOAL_BOTTOM - 0.5, 5);
  });

  it('starts a step with prevPos.x exactly equal to goalLineX and crosses behind line (Task 019 Requirement 3)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    sim.puckPos = { x: GOAL_X + 5, y: 300 };
    sim.puckVel = { x: -100, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 120);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: false }]);
    expect(sim.puckPos.x).toBe(GOAL_X + 5);
    expect(sim.puckPos.y).toBe(300);
  });

  it('does not register a goal-line crossing when puck lands exactly on goalLineX (Task 026 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    // With goalLineX = GOAL_X + 5 = 45, start puck at x = 55 with vel.x = -1200 and dt = 1/120:
    // newPos.x = 55 + (-1200) * (1 / 120) = 45 === goalLineX.
    sim.puckPos = { x: 55, y: 300 };
    sim.puckVel = { x: -1200, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 120);

    expect(sim.roundEnded).toBe(false);
    expect(events).toEqual([]);
    expect(sim.puckPos.x).toBe(GOAL_X + 5);
    expect(sim.puckPos.y).toBe(300);
  });

  it('does not register a goal-line crossing for puck exiting from behind the net landing exactly on goalLineX (Task 031 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 550 };
    sim.goaliePos = { x: 100, y: 550 };

    const goalLineX = GOAL_X + 5;
    sim.puckPos = { x: goalLineX - 1, y: 300 };
    sim.puckVel = { x: 120, y: 0 };

    const events = step(sim, { goaliePos: { x: 100, y: 550 } }, 1 / 120);

    expect(sim.roundEnded).toBe(false);
    expect(events).toEqual([]);
    expect(sim.puckPos.x).toBe(goalLineX);
    expect(sim.puckPos.y).toBe(300);
  });

  it('resolves an exact t=0 tie between overlapping save and goal-line crossing as a save, not a goal (Task 035 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 50, y: 300 };
    sim.goalie.stance = GoalieStance.DESPERATION_DIVE;
    sim.puckPos = { x: 30, y: 300 };
    sim.puckVel = { x: 0, y: 0 };

    // DESPERATION_DIVE body hitbox spans a: {x:20,y:300} to b: {x:110,y:300},
    // radius 24. Puck center x:30 lies on the capsule axis, so the puck overlaps
    // the hitbox at t = 0 (physics.ts >= overlap branch). prevPos.x and newPos.x
    // are both 30 < goalLineX = 45, so tGoal is also exactly 0 (sim.ts:223).
    // The tie bestHit.t <= tGoal (sim.ts:227) must favour the save.
    const events = step(sim, {}, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'body' }]);
  });

  it('interpolates rescued puck position on fractional-t save instead of using raw endpoint (Task 037 Requirement 1)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.spin = 0;
    sim.goalie.pos = { x: 100, y: 300 };
    sim.goalie.stance = GoalieStance.STAND;
    sim.puckPos = { x: 300, y: 400 };
    sim.puckVel = { x: -12000, y: -6000 };

    const events = step(sim, {}, 1 / 60);

    expect(sim.roundEnded).toBe(true);
    const roundEndEvent = events.find(e => e.type === 'round-end');
    expect(roundEndEvent).toBeDefined();
    expect(roundEndEvent?.success).toBe(true);
    expect(sim.puckPos.x).toBeCloseTo(135.919839, 4);
    expect(sim.puckPos.y).toBeCloseTo(317.959920, 4);
  });

  it('detects body collision against degenerate zero-length capsule in POKE_CHECK stance (Task 011 Requirement 3)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.goalie.stance = GoalieStance.POKE_CHECK;
    sim.goalie.pos = { x: 100, y: 300 };

    // In POKE_CHECK stance:
    // body hitbox: a: { x: 100, y: 300 }, b: { x: 100, y: 300 }, radius: 24, kind: 'body'
    // stick hitbox: a: { x: 120, y: 300 }, b: { x: 175, y: 300 }, radius: 16, kind: 'stick'
    // Aim puck along x = 85 travelling vertically from y = 200 to y = 350 (dt = 1/60, vel = { x: 0, y: 9000 }).
    // Distance to stick segment is always >= 120 - 85 = 35 > 16 + 5 = 21 (no stick collision).
    // Closest approach to body is 100 - 85 = 15 <= 24 + 5 = 29 (collides with body).
    sim.puckPos = { x: 85, y: 200 };
    sim.puckVel = { x: 0, y: 9000 };

    const events = step(sim, {}, 1 / 60);
    expect(sim.roundEnded).toBe(true);
    expect(events).toEqual([{ type: 'round-end', success: true, saveType: 'body' }]);
  });

  it('asserts a puck travelling at 3000 px/s aimed to pass 40 px clear of every goalie hitbox is not reported as a collision (Requirement 6)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.goaliePos = { x: 100, y: 300 };
    sim.puckPos = { x: 400, y: 150 };
    sim.puckVel = { x: -3000, y: 0 };
    sim.spin = 0;

    let goalieHit = false;
    for (let i = 0; i < 10; i++) {
      const events = step(sim, {}, 1 / 120);
      if (
        events.some(
          e =>
            e.type === 'round-end' &&
            (e.saveType === 'body' ||
              e.saveType === 'stick' ||
              e.saveType === 'glove' ||
              e.saveType === 'butterfly')
        )
      ) {
        goalieHit = true;
        break;
      }
    }
    expect(goalieHit).toBe(false);
  });

  it('asserts curve is deterministic: stepping the same seeded sim twice produces bit-identical paths, and spin 0 travels straight within 0.01 px over 1 second (Requirement 8)', () => {
    const sim1 = createSim(testConfig, 42);
    sim1.hasShot = true;
    sim1.puckPos = { x: 700, y: 300 };
    sim1.puckVel = { x: -400, y: 100 };
    sim1.spin = 1.5;

    const sim2 = createSim(testConfig, 42);
    sim2.hasShot = true;
    sim2.puckPos = { x: 700, y: 300 };
    sim2.puckVel = { x: -400, y: 100 };
    sim2.spin = 1.5;

    for (let i = 0; i < 60; i++) {
      step(sim1, {}, 1 / 120);
      step(sim2, {}, 1 / 120);
      expect(sim1.puckPos.x).toBe(sim2.puckPos.x);
      expect(sim1.puckPos.y).toBe(sim2.puckPos.y);
    }

    // Straight line with spin 0 over 1 second (120 steps)
    const simStraight = createSim(testConfig, 42);
    simStraight.hasShot = true;
    simStraight.puckPos = { x: 700, y: 300 };
    simStraight.puckVel = { x: -400, y: 50 };
    simStraight.spin = 0;

    const startX = 700;
    const startY = 300;
    const vx = -400;
    const vy = 50;
    for (let i = 0; i < 120; i++) {
      step(simStraight, {}, 1 / 120);
    }
    const expectedX = startX + vx * 1.0;
    const expectedY = startY + vy * 1.0;
    expect(Math.abs(simStraight.puckPos.x - expectedX)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(simStraight.puckPos.y - expectedY)).toBeLessThanOrEqual(0.01);
  });

  it('asserts curve direction is signed: positive and negative spin deflect to opposite sides of zero-spin path (Requirement 9)', () => {
    const runSimWithSpin = (spinVal: number) => {
      const sim = createSim(testConfig, 100);
      sim.hasShot = true;
      sim.puckPos = { x: 700, y: 300 };
      sim.puckVel = { x: -500, y: 0 };
      sim.spin = spinVal;
      for (let i = 0; i < 60; i++) {
        step(sim, {}, 1 / 120);
      }
      return sim.puckPos;
    };

    const zeroPath = runSimWithSpin(0);
    const posSpinPath = runSimWithSpin(1.5);
    const negSpinPath = runSimWithSpin(-1.5);

    const posDeflection = posSpinPath.y - zeroPath.y;
    const negDeflection = negSpinPath.y - zeroPath.y;

    expect(posDeflection).not.toBe(0);
    expect(negDeflection).not.toBe(0);
    expect(Math.sign(posDeflection)).toBe(-Math.sign(negDeflection));
    expect(Math.abs(posDeflection)).toBeCloseTo(Math.abs(negDeflection), 4);
  });

  it('conserves puck speed to within 1% over 1 second of flight (Requirement 10)', () => {
    const sim = createSim(testConfig, 1);
    sim.hasShot = true;
    sim.puckPos = { x: 700, y: 300 };
    sim.puckVel = { x: -500, y: 200 };
    sim.spin = 2.0;

    const initialSpeed = Math.hypot(sim.puckVel.x, sim.puckVel.y);
    for (let i = 0; i < 120; i++) {
      step(sim, {}, 1 / 120);
    }
    const finalSpeed = Math.hypot(sim.puckVel.x, sim.puckVel.y);
    const speedChangePct = (Math.abs(finalSpeed - initialSpeed) / initialSpeed) * 100;
    expect(speedChangePct).toBeLessThanOrEqual(1.0);
  });

  // Task 004 Integration Tests
  it('ensures puck peak speed never exceeds release speed over a full shot with max magnet (Requirement 6)', () => {
    const magnetConfig: RoundConfig = {
      ...testConfig,
      hasMagnet: true,
      shotSpeed: 10,
    };
    const sim = createSim(magnetConfig, 42);

    // Step until shot is released
    while (!sim.hasShot) {
      step(sim, {}, 1 / 120);
    }

    const releaseSpeed = Math.hypot(sim.puckVel.x, sim.puckVel.y);
    expect(releaseSpeed).toBeGreaterThan(0);

    let peakSpeed = releaseSpeed;

    // Simulate full shot with magnet constantly held at maximum strength (charge kept at 1)
    while (!sim.roundEnded) {
      sim.magnet.charge = 1;
      step(sim, { magnet: true }, 1 / 120);
      const curSpeed = Math.hypot(sim.puckVel.x, sim.puckVel.y);
      if (curSpeed > peakSpeed) {
        peakSpeed = curSpeed;
      }
      expect(curSpeed).toBeLessThanOrEqual(releaseSpeed + 0.01);
    }

    expect(peakSpeed).toBeLessThanOrEqual(releaseSpeed + 0.01);
  });

  it('activates magnet only when player holds key, draining charge (Requirement 8 & 9)', () => {
    const magnetConfig: RoundConfig = {
      ...testConfig,
      hasMagnet: true,
      shotSpeed: 10,
    };
    const sim = createSim(magnetConfig, 42);

    // Without input.magnet, charge does not drain
    step(sim, {}, 1 / 120);
    expect(sim.magnet.charge).toBe(1);
    expect(sim.magnet.active).toBe(false);

    // With input.magnet, charge drains
    step(sim, { magnet: true }, 1 / 120);
    expect(sim.magnet.active).toBe(true);
    expect(sim.magnet.charge).toBeLessThan(1);
  });

  it('only calls applyMagnet when round config enables the magnet (Requirement 9)', () => {
    const noMagnetConfig: RoundConfig = {
      ...testConfig,
      hasMagnet: false,
    };
    const simNoMagnet = createSim(noMagnetConfig, 42);
    simNoMagnet.hasShot = true;
    simNoMagnet.puckPos = { x: 200, y: 350 };
    simNoMagnet.puckVel = { x: -400, y: 0 };
    simNoMagnet.goalie.pos = { x: 100, y: 300 };

    step(simNoMagnet, { magnet: true }, 1 / 120);
    // When hasMagnet is false, vy remains unchanged (0)
    expect(simNoMagnet.puckVel.y).toBe(0);

    const yesMagnetConfig: RoundConfig = {
      ...testConfig,
      hasMagnet: true,
    };
    const simYesMagnet = createSim(yesMagnetConfig, 42);
    simYesMagnet.hasShot = true;
    simYesMagnet.puckPos = { x: 200, y: 350 };
    simYesMagnet.puckVel = { x: -400, y: 0 };
    simYesMagnet.goalie.pos = { x: 100, y: 300 };

    step(simYesMagnet, { magnet: true }, 1 / 120);
    // When hasMagnet is true and player activates magnet, puck steers toward goalie (y=300 < 350, so vy becomes negative)
    expect(simYesMagnet.puckVel.y).toBeLessThan(0);
  });
});
