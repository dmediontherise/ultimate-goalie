import { MagnetState, Vector2 } from '../types';
import {
  MAGNET_CONE_HALF_ANGLE,
  MAGNET_DRAIN_RATE,
  MAGNET_MAX_STEER_RATE,
  MAGNET_RADIUS,
  MAGNET_REGEN_RATE,
} from './constants';

export type { MagnetState };

export interface PuckMagnetInput {
  pos?: Vector2;
  vel?: Vector2;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GoalieMagnetInput {
  pos?: Vector2;
  x?: number;
  y?: number;
}

export function createMagnet(): MagnetState {
  return {
    charge: 1,
    active: false,
  };
}

export function stepMagnet(magnet: MagnetState, held: boolean, dt: number): void {
  if (dt <= 0) return;

  if (held && magnet.charge > 0) {
    magnet.active = true;
    magnet.charge = Math.max(0, magnet.charge - MAGNET_DRAIN_RATE * dt);
  } else {
    magnet.active = false;
    magnet.charge = Math.min(1, magnet.charge + MAGNET_REGEN_RATE * dt);
  }
}

export function isInMagnetField(
  puckPos: Vector2,
  goaliePos: Vector2,
  radius: number = MAGNET_RADIUS,
  halfAngle: number = MAGNET_CONE_HALF_ANGLE
): boolean {
  const dx = puckPos.x - goaliePos.x;
  const dy = puckPos.y - goaliePos.y;
  const dist = Math.hypot(dx, dy);

  if (dist > radius || dist < 1e-6) {
    return false;
  }

  // Direction from goalie to puck relative to positive x-axis (toward shooter)
  const angleFromGoalie = Math.atan2(dy, dx);
  return Math.abs(angleFromGoalie) <= halfAngle;
}

export const isInsideMagnetCone = isInMagnetField;
export const isInsideMagnetField = isInMagnetField;

/**
 * Pure function to apply magnetic steering to the puck.
 * References no globals. Rotates puck velocity toward the goalie without changing speed.
 */
export function applyMagnet(
  puck: PuckMagnetInput,
  goalie: GoalieMagnetInput,
  magnet: MagnetState | { charge?: number; active?: boolean } | number,
  dt: number
): Vector2 {
  const puckVel: Vector2 = puck.vel
    ? { x: puck.vel.x, y: puck.vel.y }
    : { x: puck.vx ?? 0, y: puck.vy ?? 0 };

  if (dt <= 0) {
    return puckVel;
  }

  const charge =
    typeof magnet === 'number'
      ? magnet
      : magnet && typeof magnet.charge === 'number'
      ? magnet.charge
      : 1;

  const active =
    typeof magnet === 'number'
      ? magnet > 0
      : magnet && magnet.active !== undefined
      ? magnet.active
      : true;

  if (!active || charge <= 0) {
    return puckVel;
  }

  const speed = Math.hypot(puckVel.x, puckVel.y);
  if (speed < 1e-9) {
    return puckVel;
  }

  const puckPos: Vector2 = puck.pos
    ? { x: puck.pos.x, y: puck.pos.y }
    : { x: puck.x ?? 0, y: puck.y ?? 0 };

  const goaliePos: Vector2 =
    'pos' in goalie && goalie.pos
      ? goalie.pos
      : { x: (goalie as { x?: number }).x ?? 0, y: (goalie as { y?: number }).y ?? 0 };

  const dx = puckPos.x - goaliePos.x;
  const dy = puckPos.y - goaliePos.y;
  const dist = Math.hypot(dx, dy);

  // Check radius and non-zero distance
  if (dist > MAGNET_RADIUS || dist < 1e-6) {
    return puckVel;
  }

  // Check cone opening toward shooter (+x)
  const angleFromGoalie = Math.atan2(dy, dx);
  if (Math.abs(angleFromGoalie) > MAGNET_CONE_HALF_ANGLE) {
    return puckVel;
  }

  // Smooth falloff: 1 at goalie (dist=0), 0 at field radius, strictly monotonic in [0, R]
  const falloff = 1 - dist / MAGNET_RADIUS;

  // Target direction: vector from puck to goalie
  const toGoalieX = goaliePos.x - puckPos.x;
  const toGoalieY = goaliePos.y - puckPos.y;
  const targetAngle = Math.atan2(toGoalieY, toGoalieX);
  const currentAngle = Math.atan2(puckVel.y, puckVel.x);

  // Shortest signed angular difference in [-PI, PI]
  const deltaAngle = Math.atan2(
    Math.sin(targetAngle - currentAngle),
    Math.cos(targetAngle - currentAngle)
  );

  if (Math.abs(deltaAngle) < 1e-9) {
    return puckVel;
  }

  const clampedCharge = Math.max(0, Math.min(1, charge));
  const maxTurn = MAGNET_MAX_STEER_RATE * falloff * clampedCharge * dt;
  if (maxTurn <= 0) {
    return puckVel;
  }

  let turn = deltaAngle;
  if (Math.abs(turn) > maxTurn) {
    turn = Math.sign(turn) * maxTurn;
  }

  const newAngle = currentAngle + turn;
  return {
    x: speed * Math.cos(newAngle),
    y: speed * Math.sin(newAngle),
  };
}
