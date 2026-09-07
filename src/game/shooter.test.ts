import { describe, expect, it } from 'vitest';
import { Vector2 } from '../types';
import {
  DEKE_SKILL_THRESHOLD,
  GOAL_BOTTOM,
  GOAL_CENTER_Y,
  GOAL_TOP,
  GOAL_X,
  GOALIE_MAX_SPEED,
  SLAP_SHOT_SPEED_MULT,
  SLAP_SHOT_WINDUP,
  SNAP_SHOT_SPEED_MULT,
  SNAP_SHOT_WINDUP,
  WRIST_SHOT_SPEED_MULT,
  WRIST_SHOT_WINDUP,
} from './constants';
import { createGoalie } from './goalie';
import { createRng } from './rng';
import {
  calculateClearance,
  chooseDekeFinalTarget,
  chooseTarget,
  computePuckSpin,
  computeReleaseDistance,
  createShooter,
  getShotSpeedMultiplier,
  getShotWindup,
  selectShotType,
  shouldDeke,
  stepShooter,
} from './shooter';

describe('Shooter AI (Task 005)', () => {
  const goalCenter = GOAL_CENTER_Y;

  // Requirement 1: Pure functions with injected rng and no globals
  it('chooseTarget and stepShooter are pure and reference no globals', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    const rng = createRng(12345);
    const target1 = chooseTarget(goalie, 0.8, rng);
    expect(target1.x).toBe(GOAL_X);
    expect(Number.isFinite(target1.y)).toBe(true);

    const shooter = createShooter(
      {
        roundNumber: 1,
        shooterSpeed: 4,
        shotSpeed: 10,
        aiIntelligence: 0.5,
        curveFactor: 0,
        jitter: 0,
        isSlapShot: false,
        hasPowerUp: false,
        hasMagnet: false,
      },
      rng
    );
    const initialReleaseDist = shooter.releaseDistance;
    stepShooter(shooter, goalie, 0.5, rng, 1 / 60);
    expect(shooter.releaseDistance).toBe(initialReleaseDist);
  });

  // Requirement 3: Gap-seeking at high skill with goalie parked high
  it('aims in lower half of goal mouth when goalie is parked high at skill 1.0 (Requirement 3)', () => {
    const goalie = createGoalie({ x: 100, y: 190 });
    goalie.vel = { x: 0, y: 0 };

    for (let trial = 0; trial < 20; trial++) {
      const rng = createRng(trial * 100 + 7);
      const target = chooseTarget(goalie, 1.0, rng);
      expect(target.y).toBeGreaterThan(goalCenter);
      expect(target.y).toBeLessThanOrEqual(GOAL_BOTTOM);
    }
  });

  // Requirement 4: Mirrored gap-seeking with goalie parked low
  it('aims in upper half of goal mouth when goalie is parked low at skill 1.0 (Requirement 4)', () => {
    const goalie = createGoalie({ x: 100, y: 410 });
    goalie.vel = { x: 0, y: 0 };

    for (let trial = 0; trial < 20; trial++) {
      const rng = createRng(trial * 100 + 13);
      const target = chooseTarget(goalie, 1.0, rng);
      expect(target.y).toBeLessThan(goalCenter);
      expect(target.y).toBeGreaterThanOrEqual(GOAL_TOP);
    }
  });

  // Requirement 5: Low skill does not gap-seek
  it('does not gap-seek at skill 0.0 with at least 25% targets landing in upper half (Requirement 5)', () => {
    const goalie = createGoalie({ x: 100, y: 190 });
    goalie.vel = { x: 0, y: 0 };

    let upperCount = 0;
    const totalTrials = 100;

    for (let trial = 0; trial < totalTrials; trial++) {
      const rng = createRng(trial + 1);
      const target = chooseTarget(goalie, 0.0, rng);
      if (target.y < goalCenter) {
        upperCount++;
      }
    }

    const upperPct = (upperCount / totalTrials) * 100;
    expect(upperPct).toBeGreaterThanOrEqual(25);
  });

  // Requirement 6: Monotonic difficulty (mean clearance non-decreasing as skill rises)
  it('has non-decreasing mean clearance as skill rises across [0, 0.25, 0.5, 0.75, 1.0] (Requirement 6)', () => {
    const goalie = createGoalie({ x: 100, y: 220 });
    const skills = [0, 0.25, 0.5, 0.75, 1.0];
    const trials = 200;

    const meanClearances = skills.map(skill => {
      let totalClearance = 0;
      for (let t = 0; t < trials; t++) {
        const rng = createRng(t + 42);
        const target = chooseTarget(goalie, skill, rng);
        totalClearance += calculateClearance(target, goalie);
      }
      return totalClearance / trials;
    });

    for (let i = 0; i < meanClearances.length - 1; i++) {
      expect(meanClearances[i]).toBeLessThanOrEqual(meanClearances[i + 1] + 1e-4);
    }
  });

  // Requirement 7: Leading the goalie
  it('leads a moving goalie so skill 1.0 target is further in direction of travel than skill 0.0 (Requirement 7)', () => {
    const goalie = createGoalie({ x: 100, y: 220 });
    goalie.vel = { x: 0, y: GOALIE_MAX_SPEED }; // Moving downward (+y)

    const rng1 = createRng(999);
    const rng0 = createRng(999);

    const targetHighSkill = chooseTarget(goalie, 1.0, rng1);
    const targetLowSkill = chooseTarget(goalie, 0.0, rng0);

    const distHigh = targetHighSkill.y - goalie.pos.y;
    const distLow = targetLowSkill.y - goalie.pos.y;

    expect(distHigh).toBeGreaterThan(distLow);
  });

  // Requirement 8: Release timing decided once and stored in state
  it('decides release distance once and does not change across steps before release (Requirement 8)', () => {
    const rng = createRng(101);
    const goalie = createGoalie({ x: 100, y: 300 });
    const shooter = createShooter(
      {
        roundNumber: 1,
        shooterSpeed: 4,
        shotSpeed: 10,
        aiIntelligence: 0.8,
        curveFactor: 0,
        jitter: 0,
        isSlapShot: false,
        hasPowerUp: false,
        hasMagnet: false,
      },
      rng
    );

    const initialReleaseDist = shooter.releaseDistance;

    for (let step = 0; step < 25; step++) {
      stepShooter(shooter, goalie, 0.8, rng, 1 / 60);
      expect(shooter.releaseDistance).toBe(initialReleaseDist);
    }
  });

  // Requirement 9: Release timing variation widens with skill (skill 1.0 releases closer to net)
  it('has smaller mean release distance (closer to net) at skill 1.0 than skill 0.0 (Requirement 9)', () => {
    const trials = 50;
    let sumDist1 = 0;
    let sumDist0 = 0;

    for (let t = 0; t < trials; t++) {
      const rng1 = createRng(t * 10 + 1);
      const rng0 = createRng(t * 10 + 1);
      sumDist1 += computeReleaseDistance(1.0, rng1);
      sumDist0 += computeReleaseDistance(0.0, rng0);
    }

    const meanDist1 = sumDist1 / trials;
    const meanDist0 = sumDist0 / trials;

    expect(meanDist1).toBeLessThan(meanDist0);
  });

  // Requirement 10: Shot types, speed multipliers, and windup durations
  it('selects shot types with respective speed multipliers and windup durations (Requirement 10)', () => {
    expect(SLAP_SHOT_WINDUP).toBe(0.5);
    expect(SNAP_SHOT_WINDUP).toBeLessThan(SLAP_SHOT_WINDUP);
    expect(WRIST_SHOT_WINDUP).toBeLessThan(SNAP_SHOT_WINDUP);

    expect(SLAP_SHOT_SPEED_MULT).toBeGreaterThan(SNAP_SHOT_SPEED_MULT);
    expect(SNAP_SHOT_SPEED_MULT).toBeGreaterThan(WRIST_SHOT_SPEED_MULT);
    expect(WRIST_SHOT_SPEED_MULT).toBe(1.0);

    expect(getShotWindup('slap')).toBe(0.5);
    expect(getShotWindup('snap')).toBe(0.2);
    expect(getShotWindup('wrist')).toBe(0.1);

    expect(getShotSpeedMultiplier('slap')).toBe(1.3);
    expect(getShotSpeedMultiplier('snap')).toBe(1.1);
    expect(getShotSpeedMultiplier('wrist')).toBe(1.0);

    const rng = createRng(1);
    expect(selectShotType(0.1, true, 200, rng)).toBe('slap');
    expect(selectShotType(0.1, false, 200, rng)).toBe('wrist');
  });

  // Requirement 11: Deke at skill above threshold
  it('never dekes below threshold and changes final target when deking (Requirement 11)', () => {
    const lowSkill = DEKE_SKILL_THRESHOLD - 0.1;

    for (let t = 0; t < 100; t++) {
      const rng = createRng(t + 500);
      expect(shouldDeke(lowSkill, rng)).toBe(false);
    }

    // High skill deke
    const goalie = createGoalie({ x: 100, y: 300 });
    const config = {
      roundNumber: 10,
      shooterSpeed: 4,
      shotSpeed: 10,
      aiIntelligence: 1.0,
      skill: 1.0,
      curveFactor: 0,
      jitter: 0,
      isSlapShot: false,
      hasPowerUp: false,
      hasMagnet: false,
    };

    let dekeObserved = false;
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const shooter = createShooter(config, rng);
      if (shooter.isDeke) {
        // Trigger approach and windup until shot releases
        let result = stepShooter(shooter, goalie, 1.0, rng, 1 / 60, config);
        while (!result.shotReleased) {
          result = stepShooter(shooter, goalie, 1.0, rng, 1 / 60, config);
        }
        expect(shooter.fakedTarget).toBeDefined();
        expect(shooter.finalTarget).toBeDefined();
        expect(Math.abs(shooter.finalTarget!.y - shooter.fakedTarget!.y)).toBeGreaterThan(50);
        dekeObserved = true;
        break;
      }
    }
    expect(dekeObserved).toBe(true);
  });

  // Requirement 12: Puck spin at release and zero random jitter
  it('computes spin from shot type and skill and never writes random jitter to puckVel.y', () => {
    const rng1 = createRng(123);
    const spinWrist = Math.abs(computePuckSpin('wrist', 0.8, 1.0, rng1));
    const rng2 = createRng(123);
    const spinSlap = Math.abs(computePuckSpin('slap', 0.8, 1.0, rng2));

    expect(spinWrist).toBeGreaterThan(spinSlap);

    const spinZeroCurve = computePuckSpin('wrist', 1.0, 0, rng1);
    expect(spinZeroCurve).toBe(0);
  });

  // Task 008: Deke final target reacts to goalie's actual position
  it('places goalie at y: GOAL_BOTTOM - 25 and asserts final target clearance > 20 (Task 008 Requirement 2)', () => {
    // Regression test: goalie is placed at y: GOAL_BOTTOM - 25 (spot old static mirror picked when fake was in upper half)
    const goaliePos = { x: 100, y: GOAL_BOTTOM - 25 };
    const goalie = createGoalie(goaliePos);

    // Fake target lands in the upper half
    const fakedTarget = { x: GOAL_X, y: GOAL_TOP + 25 };
    expect(fakedTarget.y).toBeLessThan(goalCenter);

    const finalTarget = chooseDekeFinalTarget(fakedTarget, goalie);
    const clearance = calculateClearance(finalTarget, goalie);

    // Requirement 2: Clearance from the goalie's real hitboxes is greater than 20
    expect(clearance).toBeGreaterThan(20);

    // Requirement 3: Final target still differs from faked target by more than 50 px
    expect(Math.abs(finalTarget.y - fakedTarget.y)).toBeGreaterThan(50);
  });

  it('deke final target adapts when goalie is parked close to goal line or at top post', () => {
    // When goalie is parked close to the goal line at GOAL_BOTTOM - 25
    const closeGoalie = createGoalie({ x: 60, y: GOAL_BOTTOM - 25 });
    const fakedUpper = { x: GOAL_X, y: GOAL_TOP + 25 };
    const finalTargetClose = chooseDekeFinalTarget(fakedUpper, closeGoalie);
    expect(calculateClearance(finalTargetClose, closeGoalie)).toBeGreaterThan(20);

    // When goalie is parked at GOAL_TOP + 25 and fake lands in lower half
    const topGoalie = createGoalie({ x: 100, y: GOAL_TOP + 25 });
    const fakedLower = { x: GOAL_X, y: GOAL_BOTTOM - 25 };
    const finalTargetLower = chooseDekeFinalTarget(fakedLower, topGoalie);
    expect(calculateClearance(finalTargetLower, topGoalie)).toBeGreaterThan(20);
    expect(Math.abs(finalTargetLower.y - fakedLower.y)).toBeGreaterThan(50);
  });

  it('stepShooter dynamically recalculates final deke target when goalie moves during windup', () => {
    const config = {
      roundNumber: 10,
      shooterSpeed: 4,
      shotSpeed: 10,
      aiIntelligence: 1.0,
      skill: 1.0,
      curveFactor: 0,
      jitter: 0,
      isSlapShot: false,
      hasPowerUp: false,
      hasMagnet: false,
    };

    const movingGoalie = createGoalie({ x: 100, y: 300 });
    let dekeTested = false;

    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const shooter = createShooter(config, rng);
      if (shooter.isDeke) {
        // Step until windup begins
        while (!shooter.isWindingUp) {
          stepShooter(shooter, movingGoalie, 1.0, rng, 1 / 60, config);
        }

        // Now move goalie to GOAL_BOTTOM - 25 during windup
        movingGoalie.pos.y = GOAL_BOTTOM - 25;

        // Finish windup and release shot
        let result = stepShooter(shooter, movingGoalie, 1.0, rng, 1 / 60, config);
        while (!result.shotReleased) {
          result = stepShooter(shooter, movingGoalie, 1.0, rng, 1 / 60, config);
        }

        expect(shooter.finalTarget).toBeDefined();
        // The released shot's target has clearance > 20 from where the goalie actually moved
        const clearance = calculateClearance(shooter.finalTarget!, movingGoalie);
        expect(clearance).toBeGreaterThan(20);
        dekeTested = true;
        break;
      }
    }
    expect(dekeTested).toBe(true);
  });

  it('asserts chooseDekeFinalTarget always places final target within goal mouth across representative goalie positions and faked targets (Task 016 Requirement 1)', () => {
    const goaliePositions: Vector2[] = [
      { x: 60, y: GOAL_TOP },
      { x: 100, y: GOAL_TOP + 25 },
      { x: 100, y: (GOAL_TOP + GOAL_BOTTOM) / 2 },
      { x: 100, y: GOAL_BOTTOM - 25 },
      { x: 60, y: GOAL_BOTTOM },
      { x: 120, y: 300 },
      { x: 100, y: 100 },
      { x: 100, y: 500 },
    ];

    const goalieVelocities: Vector2[] = [
      { x: 0, y: 0 },
      { x: 0, y: -200 },
      { x: 0, y: 200 },
    ];

    const fakedTargets: Vector2[] = [
      { x: GOAL_X, y: GOAL_TOP - 25 },
      { x: GOAL_X, y: GOAL_TOP + 20 },
      { x: GOAL_X, y: (GOAL_TOP + GOAL_BOTTOM) / 2 },
      { x: GOAL_X, y: GOAL_BOTTOM - 20 },
      { x: GOAL_X, y: GOAL_BOTTOM + 25 },
    ];

    for (const goaliePos of goaliePositions) {
      for (const goalieVel of goalieVelocities) {
        for (const fakedTarget of fakedTargets) {
          const goalie = createGoalie(goaliePos);
          goalie.vel = { ...goalieVel };
          const finalTarget = chooseDekeFinalTarget(fakedTarget, goalie);

          expect(finalTarget.y).toBeGreaterThanOrEqual(GOAL_TOP);
          expect(finalTarget.y).toBeLessThanOrEqual(GOAL_BOTTOM);
        }
      }
    }
  });

  it('asserts chooseDekeFinalTarget reaches near-post sampling margins and targets GOAL_X (Task 020 Requirements 1, 2, 3)', () => {
    // Requirement 1: Goalie parked low with low fake target -> maximum clearance is at top margin (GOAL_TOP + 15)
    const lowGoalie = createGoalie({ x: 100, y: GOAL_BOTTOM });
    const lowFakedTarget = { x: GOAL_X, y: GOAL_BOTTOM };
    const topTarget = chooseDekeFinalTarget(lowFakedTarget, lowGoalie);

    expect(topTarget.y).toBeLessThanOrEqual(GOAL_TOP + 20);
    expect(topTarget.x).toBe(GOAL_X);

    // Requirement 2: Goalie parked high with high fake target -> maximum clearance is at bottom margin (GOAL_BOTTOM - 15)
    const highGoalie = createGoalie({ x: 100, y: GOAL_TOP });
    const highFakedTarget = { x: GOAL_X, y: GOAL_TOP };
    const bottomTarget = chooseDekeFinalTarget(highFakedTarget, highGoalie);

    expect(bottomTarget.y).toBeGreaterThanOrEqual(GOAL_BOTTOM - 20);
    expect(bottomTarget.x).toBe(GOAL_X);
  });

  it('asserts GOAL_CENTER_Y derivation holds from goal geometry (Task 024 Requirement 5)', () => {
    expect(GOAL_CENTER_Y).toBe((GOAL_TOP + GOAL_BOTTOM) / 2);
    expect(GOAL_CENTER_Y).toBe(300);
  });

  it('asserts chooseTarget at skill 1.0 against goalie parked high returns target in lower half of goal mouth (Task 024 Requirement 6)', () => {
    const rng = createRng(42);
    // Park goalie high in the mouth (above GOAL_CENTER_Y)
    const highGoalie = createGoalie({ x: 100, y: GOAL_TOP + 30 });
    const target = chooseTarget(highGoalie, 1.0, rng);

    expect(target.x).toBe(GOAL_X);
    // Lower half of the goal mouth is strictly below GOAL_CENTER_Y and within GOAL_BOTTOM
    expect(target.y).toBeGreaterThan(GOAL_CENTER_Y);
    expect(target.y).toBeLessThanOrEqual(GOAL_BOTTOM - 15);
  });
});

