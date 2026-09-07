import { describe, expect, it } from 'vitest';
import {
  createGoalie,
  getHitboxes,
  GoalieState,
  stepGoalie,
} from './goalie';
import {
  DIVE_COST,
  GLOVE_SNAG_COST,
  GOALIE_MAX_SPEED,
  POKE_COST,
  STAMINA_REGEN_RATE,
} from './constants';
import { GoalieStance, StickPosition } from '../types';

describe('Goalie Movement and Physics (Requirements 2, 3, 4)', () => {
  it('reaches at least 90% of max speed within 0.25 s of held input, and decelerates to under 5% within 0.20 s of release (Requirement 3)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;

    // 1. Accelerate with held input for 0.25s
    for (let t = 0; t < 0.25; t += dt) {
      stepGoalie(goalie, { right: true }, dt);
    }
    const currentSpeed = Math.hypot(goalie.vel.x, goalie.vel.y);
    expect(currentSpeed).toBeGreaterThanOrEqual(216); // 90% of max speed 240

    // 2. Release input and decelerate for 0.20s
    for (let t = 0; t < 0.20; t += dt) {
      stepGoalie(goalie, {}, dt);
    }
    const stoppedSpeed = Math.hypot(goalie.vel.x, goalie.vel.y);
    expect(stoppedSpeed).toBeLessThan(12); // 5% of max speed 240
  });

  it('clamps goalie position to bounds [50, 140] on x and [50, 550] on y (Requirement 4)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    const dt = 1 / 60;

    // Drive far to the left
    for (let i = 0; i < 120; i++) {
      stepGoalie(goalie, { left: true }, dt);
    }
    expect(goalie.pos.x).toBe(50);

    // Drive far to the right
    for (let i = 0; i < 120; i++) {
      stepGoalie(goalie, { right: true }, dt);
    }
    expect(goalie.pos.x).toBe(140);

    // Drive far up
    for (let i = 0; i < 120; i++) {
      stepGoalie(goalie, { up: true }, dt);
    }
    expect(goalie.pos.y).toBe(50);

    // Drive far down
    for (let i = 0; i < 250; i++) {
      stepGoalie(goalie, { down: true }, dt);
    }
    expect(goalie.pos.y).toBe(550);
  });

  it('sets goalie position directly when input.goaliePos is within bounds (Task 012 Requirement 1)', () => {
    const goalie = createGoalie({ x: 80, y: 200 });
    stepGoalie(goalie, { goaliePos: { x: 100, y: 300 } }, 1 / 60);
    expect(goalie.pos).toEqual({ x: 100, y: 300 });
    expect(goalie.vel).toEqual({ x: 0, y: 0 });
  });

  it('clamps goalie position when input.goaliePos is outside bounds (Task 012 Requirement 2)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });

    // Below minimum bounds: x < 50, y < 50
    stepGoalie(goalie, { goaliePos: { x: 10, y: 20 } }, 1 / 60);
    expect(goalie.pos.x).toBe(50);
    expect(goalie.pos.y).toBe(50);

    // Above maximum bounds: x > 140, y > 550
    stepGoalie(goalie, { goaliePos: { x: 200, y: 900 } }, 1 / 60);
    expect(goalie.pos.x).toBe(140);
    expect(goalie.pos.y).toBe(550);
  });

  it('uses directional-input movement when input.goaliePos is absent (Task 012 Requirement 3)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    stepGoalie(goalie, { down: true }, 1 / 60);
    expect(goalie.vel.y).toBeGreaterThan(0);
    expect(goalie.pos.y).toBeGreaterThan(300);
  });

  it('resets goalie velocity to zero when direct-position input takes over moving goalie (Task 021 Requirement 1)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    stepGoalie(goalie, { up: true }, 1 / 60);
    expect(goalie.vel.y).toBeLessThan(0);

    stepGoalie(goalie, { goaliePos: { x: 100, y: 250 } }, 1 / 60);
    expect(goalie.vel).toEqual({ x: 0, y: 0 });
  });

  it('resets goalie horizontal velocity to zero when direct-position input takes over (Task 027 Requirement 1)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    stepGoalie(goalie, { right: true }, 1 / 60);
    expect(goalie.vel.x).toBeGreaterThan(0);

    stepGoalie(goalie, { goaliePos: { x: 120, y: 300 } }, 1 / 60);
    expect(goalie.vel).toEqual({ x: 0, y: 0 });
  });

  it('resets goalie negative horizontal velocity to zero when direct-position input takes over (Task 032 Requirement 1)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    stepGoalie(goalie, { left: true }, 1 / 60);
    expect(goalie.vel.x).toBeLessThan(0);

    stepGoalie(goalie, { goaliePos: { x: 90, y: 300 } }, 1 / 60);
    expect(goalie.vel).toEqual({ x: 0, y: 0 });
  });

  it('resets goalie positive vertical velocity to zero when direct-position input takes over (Task 032 Requirement 2)', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    stepGoalie(goalie, { down: true }, 1 / 60);
    expect(goalie.vel.y).toBeGreaterThan(0);

    stepGoalie(goalie, { goaliePos: { x: 100, y: 350 } }, 1 / 60);
    expect(goalie.vel).toEqual({ x: 0, y: 0 });
  });


  it('preserves fractional coordinates exactly for direct-position input within bounds (Task 021 Requirement 2)', () => {
    const goalie = createGoalie({ x: 80, y: 200 });
    stepGoalie(goalie, { goaliePos: { x: 100.37, y: 300.82 } }, 1 / 60);
    expect(goalie.pos.x).toBe(100.37);
    expect(goalie.pos.y).toBe(300.82);
    expect(goalie.pos).toEqual({ x: 100.37, y: 300.82 });
  });
});

describe('Goalie Stance Machine and Recovery (Requirement 5)', () => {
  it('rejects a move requested during recovery and does not change stance', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;

    // Start poke check
    stepGoalie(goalie, { pokeCheck: true }, dt);
    expect(goalie.stance).toBe(GoalieStance.POKE_CHECK);

    // Advance past active window into recovery
    while (goalie.activeTimer > 0) {
      stepGoalie(goalie, {}, dt);
    }
    expect(goalie.recoveryTimer).toBeGreaterThan(0);
    expect(goalie.stance).toBe(GoalieStance.STAND);

    // Request dive during recovery
    stepGoalie(goalie, { dive: true }, dt);
    // Move must be rejected: stance remains STAND, not DESPERATION_DIVE
    expect(goalie.stance).toBe(GoalieStance.STAND);
  });
});

describe('Goalie Abilities and Stamina (Requirements 7, 8, 9, 10)', () => {
  it('poke check extends stick forward and consumes stamina (Requirement 7)', () => {
    const goalie = createGoalie();
    const initialStamina = goalie.stamina;

    stepGoalie(goalie, { pokeCheck: true }, 1 / 120);
    expect(goalie.stance).toBe(GoalieStance.POKE_CHECK);
    expect(goalie.stamina).toBeCloseTo(0.75, 2); // 1.0 - 0.25 poke cost

    const hitboxes = getHitboxes(goalie);
    const stick = hitboxes.find(h => h.kind === 'stick');
    expect(stick).toBeDefined();
    // Stick extends forward (+x)
    expect(stick!.b.x).toBeGreaterThan(goalie.pos.x + 50);
  });

  it('desperation dive adds lateral velocity impulse and extends horizontal hitbox (Requirement 8)', () => {
    const goalie = createGoalie();
    const initialStamina = goalie.stamina;

    stepGoalie(goalie, { dive: true, up: true }, 1 / 120);
    expect(goalie.stance).toBe(GoalieStance.DESPERATION_DIVE);
    expect(goalie.vel.y).toBeLessThan(-300); // large upward impulse
    expect(goalie.stamina).toBeCloseTo(0.55, 2); // 1.0 - 0.45 dive cost

    const hitboxes = getHitboxes(goalie);
    expect(hitboxes.length).toBe(1);
    // Long horizontal capsule
    expect(hitboxes[0].b.x - hitboxes[0].a.x).toBeGreaterThan(50);
  });

  it('glove snag enlarges glove hitbox during active window (Requirement 9)', () => {
    const goalieStand = createGoalie();
    goalieStand.stickPos = StickPosition.UP;
    const normalGlove = getHitboxes(goalieStand).find(h => h.kind === 'glove');

    const goalieSnag = createGoalie();
    stepGoalie(goalieSnag, { gloveSnag: true }, 1 / 120);
    expect(goalieSnag.stance).toBe(GoalieStance.GLOVE_SNAG);

    const enlargedGlove = getHitboxes(goalieSnag).find(h => h.kind === 'glove');
    expect(enlargedGlove).toBeDefined();
    expect(enlargedGlove!.radius).toBeGreaterThan(normalGlove!.radius);
  });

  it('throttles spamming dive: attempting dive every step for 1s yields strictly fewer than 5 successful dives (Requirement 10)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;
    let successfulDives = 0;
    let inDive = false;

    // 1 second = 120 steps
    for (let i = 0; i < 120; i++) {
      stepGoalie(goalie, { dive: true, down: true }, dt);
      if (goalie.stance === GoalieStance.DESPERATION_DIVE) {
        if (!inDive) {
          successfulDives++;
          inDive = true;
        }
      } else {
        inDive = false;
      }
    }

    expect(successfulDives).toBeLessThan(5);
  });

  it('consumes 0.2 stamina when performing a glove snag (Task 029 Requirement 1)', () => {
    const goalie = createGoalie();
    const initialStamina = goalie.stamina;

    stepGoalie(goalie, { gloveSnag: true }, 1 / 120);
    expect(goalie.stance).toBe(GoalieStance.GLOVE_SNAG);
    expect(initialStamina - goalie.stamina).toBeCloseTo(0.2, 5);
    expect(goalie.stamina).toBeCloseTo(0.8, 5);
  });

  it('regenerates stamina at literal rate 0.3 per second during idle steps (Task 029 Requirement 2)', () => {
    const goalie = createGoalie();
    goalie.stamina = 0.5;
    const staminaBefore = goalie.stamina;

    const dt = 1 / 120;
    // Step idle for 1.0 second (120 steps)
    for (let i = 0; i < 120; i++) {
      stepGoalie(goalie, {}, dt);
    }

    // 0.3 rate * 1.0 second = 0.3 increase
    expect(goalie.stamina - staminaBefore).toBeCloseTo(0.3, 5);
    expect(goalie.stamina).toBeCloseTo(0.8, 5);
  });

  it('regenerates stamina during an active stance window (Task 034 Requirement 1)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;

    stepGoalie(goalie, { gloveSnag: true }, dt);
    expect(goalie.stance).toBe(GoalieStance.GLOVE_SNAG);
    expect(goalie.activeTimer).toBeGreaterThan(0);

    const staminaBefore = goalie.stamina;
    stepGoalie(goalie, {}, dt);

    expect(goalie.activeTimer).toBeGreaterThan(0); // still inside the active window
    // Regen must not be gated to idle-only: the single idle tick still adds 0.3 * dt.
    expect(goalie.stamina).toBeCloseTo(staminaBefore + STAMINA_REGEN_RATE * dt, 5);
  });

  it('regenerates stamina during a recovery window (Task 034 Requirement 2)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;

    stepGoalie(goalie, { pokeCheck: true }, dt);
    expect(goalie.stance).toBe(GoalieStance.POKE_CHECK);

    // Drive past the active window into recovery.
    while (goalie.activeTimer > 0) {
      stepGoalie(goalie, {}, dt);
    }
    expect(goalie.activeTimer).toBe(0);
    expect(goalie.recoveryTimer).toBeGreaterThan(0);

    const staminaBefore = goalie.stamina;
    stepGoalie(goalie, {}, dt);

    expect(goalie.recoveryTimer).toBeGreaterThan(0); // still recovering
    expect(goalie.stamina).toBeCloseTo(staminaBefore + STAMINA_REGEN_RATE * dt, 5);
  });

  it('rejects dive when stamina is below DIVE_COST (Task 033 Requirement 1)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;
    goalie.stamina = DIVE_COST - 0.01;

    stepGoalie(goalie, { dive: true }, dt);

    expect(goalie.stance).toBe(GoalieStance.STAND);
    // Only the 0.3/s idle regen applies; the DIVE_COST deduction must not.
    expect(goalie.stamina).toBeCloseTo(DIVE_COST - 0.01 + STAMINA_REGEN_RATE * dt, 5);
  });

  it('rejects poke check when stamina is below POKE_COST (Task 033 Requirement 2)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;
    goalie.stamina = POKE_COST - 0.01;

    stepGoalie(goalie, { pokeCheck: true }, dt);

    expect(goalie.stance).toBe(GoalieStance.STAND);
    expect(goalie.stamina).toBeCloseTo(POKE_COST - 0.01 + STAMINA_REGEN_RATE * dt, 5);
  });

  it('rejects glove snag when stamina is below GLOVE_SNAG_COST (Task 033 Requirement 3)', () => {
    const goalie = createGoalie();
    const dt = 1 / 120;
    goalie.stamina = GLOVE_SNAG_COST - 0.01;

    stepGoalie(goalie, { gloveSnag: true }, dt);

    expect(goalie.stance).toBe(GoalieStance.STAND);
    expect(goalie.stamina).toBeCloseTo(GLOVE_SNAG_COST - 0.01 + STAMINA_REGEN_RATE * dt, 5);
  });
});


describe('Hitbox Validity and Robustness (Requirement 11)', () => {
  it('asserts every hitbox returned by getHitboxes for every stance is finite and has positive radius', () => {
    const stances: GoalieStance[] = [
      GoalieStance.STAND,
      GoalieStance.BUTTERFLY,
      GoalieStance.POKE_CHECK,
      GoalieStance.DESPERATION_DIVE,
      GoalieStance.GLOVE_SNAG,
    ];

    for (const stance of stances) {
      const goalie = createGoalie({ x: 100, y: 300 });
      goalie.stance = stance;

      const hitboxes = getHitboxes(goalie);
      expect(hitboxes.length).toBeGreaterThan(0);

      for (const h of hitboxes) {
        expect(Number.isFinite(h.a.x)).toBe(true);
        expect(Number.isFinite(h.a.y)).toBe(true);
        expect(Number.isFinite(h.b.x)).toBe(true);
        expect(Number.isFinite(h.b.y)).toBe(true);
        expect(Number.isFinite(h.radius)).toBe(true);
        expect(h.radius).toBeGreaterThan(0);
        expect(['body', 'stick', 'glove', 'butterfly', 'miss']).toContain(h.kind);
      }
    }
  });
});
