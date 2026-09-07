import { GoalieStance, RoundConfig, ShooterState, ShotType, StickPosition, Vector2 } from '../types';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEKE_SKILL_THRESHOLD,
  ESTIMATED_FLIGHT_TIME,
  GOAL_BOTTOM,
  GOAL_CENTER_Y,
  GOAL_TOP,
  GOAL_X,
  SHOOTER_MAX_RELEASE_DIST_HIGH_SKILL,
  SHOOTER_MAX_RELEASE_DIST_LOW_SKILL,
  SHOOTER_MIN_RELEASE_DIST_HIGH_SKILL,
  SHOOTER_MIN_RELEASE_DIST_LOW_SKILL,
  SLAP_SHOT_SPEED_MULT,
  SLAP_SHOT_WINDUP,
  SNAP_SHOT_SPEED_MULT,
  SNAP_SHOT_WINDUP,
  WRIST_SHOT_SPEED_MULT,
  WRIST_SHOT_WINDUP,
} from './constants';
import { getHitboxes, GoalieState } from './goalie';

export type { ShooterState, ShotType };

export interface ShooterStepResult {
  shotReleased: boolean;
  target?: Vector2;
  puckVel?: Vector2;
  spin?: number;
  dtRemaining?: number;
}

/**
 * Calculates minimum distance (clearance) between a target point and goalie's hitboxes.
 */
export function calculateClearance(target: Vector2, goalie: GoalieState): number {
  const fullGoalie: GoalieState = {
    pos: goalie.pos ?? { x: 100, y: GOAL_CENTER_Y },
    vel: goalie.vel ?? { x: 0, y: 0 },
    stance: goalie.stance ?? GoalieStance.STAND,
    stickPos: goalie.stickPos ?? StickPosition.STRAIGHT,
    stanceLerp: goalie.stanceLerp ?? 0,
    stamina: goalie.stamina ?? 1,
    activeTimer: goalie.activeTimer ?? 0,
    recoveryTimer: goalie.recoveryTimer ?? 0,
  };

  const hitboxes = getHitboxes(fullGoalie);
  let minClearance = Infinity;

  for (const h of hitboxes) {
    const abx = h.b.x - h.a.x;
    const aby = h.b.y - h.a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq < 1e-9 ? 0 : ((target.x - h.a.x) * abx + (target.y - h.a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const qx = h.a.x + t * abx;
    const qy = h.a.y + t * aby;
    const dist = Math.hypot(target.x - qx, target.y - qy) - h.radius;
    if (dist < minClearance) {
      minClearance = dist;
    }
  }

  return minClearance;
}

export const getClearance = calculateClearance;

/**
 * Chooses a target on the goal mouth by scoring candidate clearances,
 * blending with a random candidate by skill, and applying goalie velocity lead.
 */
export function chooseTarget(
  goalie: GoalieState,
  skill: number,
  rng: () => number,
  shooterPos?: Vector2
): Vector2 {
  const clampedSkill = Math.max(0, Math.min(1, skill));
  const yMin = GOAL_TOP + 15;
  const yMax = GOAL_BOTTOM - 15;
  const numCandidates = 40;

  let bestY = (yMin + yMax) / 2;
  let maxClearance = -Infinity;

  for (let i = 0; i < numCandidates; i++) {
    const candidateY = yMin + (i / (numCandidates - 1)) * (yMax - yMin);
    const candidatePt: Vector2 = { x: GOAL_X, y: candidateY };
    const clearance = calculateClearance(candidatePt, goalie);

    // If clearance is strictly better, or equal tie broken in direction of goalie vel
    const goalieVy = goalie.vel?.y ?? 0;
    const isTie = Math.abs(clearance - maxClearance) < 1e-4;
    const preferByVel = isTie && goalieVy !== 0 && Math.sign(candidateY - GOAL_CENTER_Y) === Math.sign(goalieVy);

    if (clearance > maxClearance || preferByVel) {
      maxClearance = clearance;
      bestY = candidateY;
    }
  }

  // Random candidate
  const randY = yMin + rng() * (yMax - yMin);

  // Blend by skill
  let targetY = (1 - clampedSkill) * randY + clampedSkill * bestY;

  // Lead the goalie: offset by goalie velocity * estimated flight time * skill
  const goalieVy = goalie.vel?.y ?? 0;
  const leadOffset = goalieVy * ESTIMATED_FLIGHT_TIME * clampedSkill;
  targetY += leadOffset;

  // Clamp within goal mouth boundaries
  targetY = Math.max(GOAL_TOP + 10, Math.min(GOAL_BOTTOM - 10, targetY));

  return {
    x: GOAL_X,
    y: targetY,
  };
}

/**
 * Draws release distance once at start of approach.
 * High skill releases closer to the net (smaller distance) than low skill.
 */
export function computeReleaseDistance(skill: number, rng: () => number): number {
  const s = Math.max(0, Math.min(1, skill));
  const minDist =
    SHOOTER_MIN_RELEASE_DIST_LOW_SKILL +
    s * (SHOOTER_MIN_RELEASE_DIST_HIGH_SKILL - SHOOTER_MIN_RELEASE_DIST_LOW_SKILL);
  const maxDist =
    SHOOTER_MAX_RELEASE_DIST_LOW_SKILL +
    s * (SHOOTER_MAX_RELEASE_DIST_HIGH_SKILL - SHOOTER_MAX_RELEASE_DIST_LOW_SKILL);
  return minDist + rng() * (maxDist - minDist);
}

export function getShotWindup(shotType: ShotType): number {
  switch (shotType) {
    case 'slap':
      return SLAP_SHOT_WINDUP;
    case 'snap':
      return SNAP_SHOT_WINDUP;
    case 'wrist':
    default:
      return WRIST_SHOT_WINDUP;
  }
}

export function getShotSpeedMultiplier(shotType: ShotType): number {
  switch (shotType) {
    case 'slap':
      return SLAP_SHOT_SPEED_MULT;
    case 'snap':
      return SNAP_SHOT_SPEED_MULT;
    case 'wrist':
    default:
      return WRIST_SHOT_SPEED_MULT;
  }
}

export function selectShotType(
  skill: number,
  isSlapShotConfig: boolean,
  releaseDist: number,
  rng: () => number
): ShotType {
  if (isSlapShotConfig) {
    return 'slap';
  }
  if (skill < 0.3) {
    return 'wrist';
  }
  if (skill < 0.7) {
    return rng() > 0.4 ? 'snap' : 'wrist';
  }
  // High skill: situational selection
  const roll = rng();
  if (releaseDist > 220 && roll > 0.5) {
    return 'slap';
  } else if (roll > 0.3) {
    return 'snap';
  } else {
    return 'wrist';
  }
}

export function shouldDeke(skill: number, rng: () => number): boolean {
  if (skill < DEKE_SKILL_THRESHOLD) {
    return false;
  }
  const dekeProb = 0.5 + (skill - DEKE_SKILL_THRESHOLD) * 0.5;
  return rng() < dekeProb;
}

/**
 * Chooses a deke final target reacting to the goalie's actual position and hitboxes.
 * Evaluates candidate points on the goal line using calculateClearance,
 * selecting a target with maximum clearance from the goalie's real hitboxes
 * that differs from fakedTarget by more than 50 px.
 */
export function chooseDekeFinalTarget(fakedTarget: Vector2, goalie: GoalieState): Vector2 {
  const yMin = GOAL_TOP + 15;
  const yMax = GOAL_BOTTOM - 15;
  const numCandidates = 40;
  const fakeY = fakedTarget?.y ?? GOAL_CENTER_Y;

  let bestY = (yMin + yMax) / 2;
  let maxClearance = -Infinity;

  // 1. Evaluate candidates that differ from fakedTarget by more than 50 px
  for (let i = 0; i < numCandidates; i++) {
    const candidateY = yMin + (i / (numCandidates - 1)) * (yMax - yMin);
    const diff = Math.abs(candidateY - fakeY);
    if (diff <= 50) {
      continue;
    }

    const candidatePt: Vector2 = { x: GOAL_X, y: candidateY };
    const clearance = calculateClearance(candidatePt, goalie);

    const goalieVy = goalie.vel?.y ?? 0;
    const isTie = Math.abs(clearance - maxClearance) < 1e-4;
    const preferByVel = isTie && goalieVy !== 0 && Math.sign(candidateY - GOAL_CENTER_Y) === Math.sign(goalieVy);
    const preferByDist = isTie && !preferByVel && diff > Math.abs(bestY - fakeY);

    if (clearance > maxClearance || preferByVel || preferByDist) {
      maxClearance = clearance;
      bestY = candidateY;
    }
  }

  // 2. Fallback: if no candidate was > 50 px away, pick candidate with maximum clearance
  if (maxClearance === -Infinity) {
    for (let i = 0; i < numCandidates; i++) {
      const candidateY = yMin + (i / (numCandidates - 1)) * (yMax - yMin);
      const candidatePt: Vector2 = { x: GOAL_X, y: candidateY };
      const clearance = calculateClearance(candidatePt, goalie);

      if (clearance > maxClearance) {
        maxClearance = clearance;
        bestY = candidateY;
      }
    }
  }

  return {
    x: GOAL_X,
    y: bestY,
  };
}

export function computePuckSpin(
  shotType: ShotType,
  skill: number,
  curveFactor: number,
  rng: () => number
): number {
  if (curveFactor === 0) return 0;
  const typeMult = shotType === 'wrist' ? 1.2 : shotType === 'snap' ? 1.0 : 0.6;
  const magnitude = curveFactor * (1 + skill * 0.4) * typeMult;
  const sign = rng() > 0.5 ? 1 : -1;
  return sign * magnitude;
}

export function createShooter(
  config: RoundConfig,
  rng: () => number,
  initialPos?: Vector2
): ShooterState {
  const skill = config.skill ?? config.aiIntelligence ?? 0.5;
  const releaseDistance = computeReleaseDistance(skill, rng);
  const shotType = selectShotType(skill, config.isSlapShot, releaseDistance, rng);
  const windUpDuration = getShotWindup(shotType);
  const isDeke = shouldDeke(skill, rng);

  const startX = initialPos?.x ?? CANVAS_WIDTH - 100;
  const startY = initialPos?.y ?? CANVAS_HEIGHT / 2;

  return {
    pos: { x: startX, y: startY },
    vel: { x: 0, y: 0 },
    releaseDistance,
    shotType,
    windUpDuration,
    windUpElapsed: 0,
    isWindingUp: false,
    hasShot: false,
    isDeke,
  };
}

function releaseShot(
  state: ShooterState,
  goalie: GoalieState,
  skill: number,
  rng: () => number,
  config: RoundConfig | undefined,
  dtRemaining: number
): ShooterStepResult {
  state.hasShot = true;
  state.isWindingUp = false;

  if (state.isDeke && state.fakedTarget) {
    state.finalTarget = chooseDekeFinalTarget(state.fakedTarget, goalie);
    state.currentTarget = state.finalTarget;
  }

  const target = state.finalTarget ?? state.currentTarget ?? chooseTarget(goalie, skill, rng);
  const puckStartX = state.pos.x - 20;
  const puckStartY = state.pos.y;

  const dx = target.x - puckStartX;
  const dy = target.y - puckStartY;
  const dist = Math.hypot(dx, dy);

  const baseSpeed = (config?.shotSpeed ?? 10) * 60;
  const speedMultiplier = getShotSpeedMultiplier(state.shotType);
  const finalSpeed = baseSpeed * speedMultiplier;

  const puckVel: Vector2 = {
    x: (dx / dist) * finalSpeed,
    y: (dy / dist) * finalSpeed,
  };

  const curveFactor = config?.curveFactor ?? 0;
  const spin = computePuckSpin(state.shotType, skill, curveFactor, rng);

  return {
    shotReleased: true,
    target,
    puckVel,
    spin,
    dtRemaining,
  };
}

/**
 * Pure function to step shooter approach, windup, deke, and release.
 * References no globals. Randomness comes solely from injected rng.
 */
export function stepShooter(
  state: ShooterState,
  goalie: GoalieState,
  skill: number,
  rng: () => number,
  dt: number,
  config?: RoundConfig,
  simTime: number = 0
): ShooterStepResult {
  if (state.hasShot || dt <= 0) {
    return { shotReleased: false };
  }

  const shooterSpeed = config?.shooterSpeed ?? 4;
  const stepDist = shooterSpeed * 60 * dt;

  if (!state.isWindingUp) {
    if (state.pos.x - stepDist <= state.releaseDistance) {
      const dtToThreshold =
        shooterSpeed > 0
          ? Math.max(0, (state.pos.x - state.releaseDistance) / (shooterSpeed * 60))
          : 0;
      const dtRemaining = Math.max(0, dt - dtToThreshold);

      state.pos.x = state.releaseDistance;
      const tMid = (simTime + dtToThreshold * 0.5) * 5;
      const dy = Math.sin(tMid) * shooterSpeed * 0.5 * 60;
      state.pos.y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, state.pos.y + dy * dtToThreshold));

      state.isWindingUp = true;
      state.windUpElapsed = 0;

      const baseTarget = chooseTarget(goalie, skill, rng);
      if (state.isDeke) {
        state.fakedTarget = baseTarget;
        state.currentTarget = baseTarget;
        state.finalTarget = chooseDekeFinalTarget(baseTarget, goalie);
      } else {
        state.currentTarget = baseTarget;
        state.finalTarget = baseTarget;
      }

      if (state.windUpDuration <= 0 || dtRemaining >= state.windUpDuration) {
        const dtAfterWindup = dtRemaining - state.windUpDuration;
        return releaseShot(state, goalie, skill, rng, config, dtAfterWindup);
      } else {
        state.windUpElapsed += dtRemaining;
        return { shotReleased: false };
      }
    } else {
      state.pos.x -= stepDist;
      const tMid = (simTime + dt * 0.5) * 5;
      const dy = Math.sin(tMid) * shooterSpeed * 0.5 * 60;
      state.pos.y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, state.pos.y + dy * dt));
      return { shotReleased: false };
    }
  } else {
    state.windUpElapsed += dt;

    if (state.isDeke && state.windUpElapsed >= state.windUpDuration * 0.5) {
      if (state.fakedTarget) {
        state.finalTarget = chooseDekeFinalTarget(state.fakedTarget, goalie);
      }
      state.currentTarget = state.finalTarget;
    }

    if (state.windUpElapsed >= state.windUpDuration) {
      if (state.isDeke && state.fakedTarget) {
        state.finalTarget = chooseDekeFinalTarget(state.fakedTarget, goalie);
        state.currentTarget = state.finalTarget;
      }
      const dtAfterWindup = state.windUpElapsed - state.windUpDuration;
      return releaseShot(state, goalie, skill, rng, config, dtAfterWindup);
    }
    return { shotReleased: false };
  }
}
