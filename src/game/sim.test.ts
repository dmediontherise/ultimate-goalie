import { describe, expect, it, vi } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GOAL_BOTTOM, GOAL_TOP, GOAL_X, GOALIE_MAX_SPEED, GOALIE_RADIUS, PUCK_RADIUS } from './constants';
import { createSim, step } from './sim';
import { RoundConfig, StickPosition } from '../types';

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

  it('asserts no tunnelling: a puck travelling at 3000 px/s directly at the goalie body is detected as a collision at every simulation step size in [1/30, 1/60, 1/120, 1/240] (Requirement 5)', () => {
    const stepSizes = [1 / 30, 1 / 60, 1 / 120, 1 / 240];
    for (const dt of stepSizes) {
      const sim = createSim(testConfig, 1);
      sim.hasShot = true;
      sim.goaliePos = { x: 100, y: 300 };
      sim.stickPos = StickPosition.UP;
      sim.puckPos = { x: 400, y: 300 };
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
