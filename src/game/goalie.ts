import { GoalieStance, Hitbox, StickPosition, Vector2 } from '../types';
import {
  DIVE_ACTIVE_DURATION,
  DIVE_COST,
  DIVE_IMPULSE_SPEED,
  DIVE_RECOVERY_DURATION,
  GLOVE_SNAG_ACTIVE_DURATION,
  GLOVE_SNAG_COST,
  GLOVE_SNAG_RECOVERY_DURATION,
  GOALIE_ACCEL,
  GOALIE_DECEL,
  GOALIE_MAX_SPEED,
  GOALIE_RADIUS,
  POKE_ACTIVE_DURATION,
  POKE_COST,
  POKE_RECOVERY_DURATION,
  STAMINA_REGEN_RATE,
} from './constants';

export interface GoalieState {
  pos: Vector2;
  vel: Vector2;
  stance: GoalieStance;
  stickPos: StickPosition;
  stanceLerp: number;
  stamina: number;
  activeTimer: number;
  recoveryTimer: number;
}

export interface GoalieInput {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  stickPos?: StickPosition;
  goaliePos?: Vector2;
  pokeCheck?: boolean;
  dive?: boolean;
  gloveSnag?: boolean;
}

export function createGoalie(initialPos?: Vector2): GoalieState {
  return {
    pos: initialPos ? { ...initialPos } : { x: 100, y: 300 },
    vel: { x: 0, y: 0 },
    stance: GoalieStance.STAND,
    stickPos: StickPosition.STRAIGHT,
    stanceLerp: 0,
    stamina: 1.0,
    activeTimer: 0,
    recoveryTimer: 0,
  };
}

export function stepGoalie(state: GoalieState, input: GoalieInput = {}, dt: number): void {
  // 1. Stamina regeneration
  state.stamina = Math.min(1.0, state.stamina + STAMINA_REGEN_RATE * dt);

  // 2. Active and recovery timers
  if (state.activeTimer > 0) {
    state.activeTimer = Math.max(0, state.activeTimer - dt);
    if (state.activeTimer === 0) {
      if (state.stance === GoalieStance.POKE_CHECK) {
        state.recoveryTimer = POKE_RECOVERY_DURATION;
      } else if (state.stance === GoalieStance.DESPERATION_DIVE) {
        state.recoveryTimer = DIVE_RECOVERY_DURATION;
      } else if (state.stance === GoalieStance.GLOVE_SNAG) {
        state.recoveryTimer = GLOVE_SNAG_RECOVERY_DURATION;
      }
      state.stance = state.stickPos === StickPosition.DOWN ? GoalieStance.BUTTERFLY : GoalieStance.STAND;
    }
  } else if (state.recoveryTimer > 0) {
    state.recoveryTimer = Math.max(0, state.recoveryTimer - dt);
  }

  // 3. Stance transitions and move inputs
  const canStartMove = state.activeTimer === 0 && state.recoveryTimer === 0;

  if (input.dive) {
    if (canStartMove && state.stamina >= DIVE_COST) {
      state.stamina -= DIVE_COST;
      state.stance = GoalieStance.DESPERATION_DIVE;
      state.activeTimer = DIVE_ACTIVE_DURATION;
      let impulseDir = 0;
      if (input.up) impulseDir = -1;
      else if (input.down) impulseDir = 1;
      else impulseDir = state.vel.y !== 0 ? Math.sign(state.vel.y) : -1;
      state.vel.y = impulseDir * DIVE_IMPULSE_SPEED;
    }
  } else if (input.pokeCheck) {
    if (canStartMove && state.stamina >= POKE_COST) {
      state.stamina -= POKE_COST;
      state.stance = GoalieStance.POKE_CHECK;
      state.activeTimer = POKE_ACTIVE_DURATION;
    }
  } else if (input.gloveSnag) {
    if (canStartMove && state.stamina >= GLOVE_SNAG_COST) {
      state.stamina -= GLOVE_SNAG_COST;
      state.stance = GoalieStance.GLOVE_SNAG;
      state.activeTimer = GLOVE_SNAG_ACTIVE_DURATION;
    }
  } else if (state.activeTimer === 0) {
    if (input.stickPos !== undefined) {
      state.stickPos = input.stickPos;
      if (state.stance === GoalieStance.STAND || state.stance === GoalieStance.BUTTERFLY) {
        state.stance = state.stickPos === StickPosition.DOWN ? GoalieStance.BUTTERFLY : GoalieStance.STAND;
      }
    }
  }

  // 4. Movement integration
  if (input.goaliePos) {
    state.pos.x = Math.max(50, Math.min(140, input.goaliePos.x));
    state.pos.y = Math.max(50, Math.min(550, input.goaliePos.y));
    state.vel = { x: 0, y: 0 };
  } else {
    let targetX = 0;
    let targetY = 0;
    if (input.left) targetX -= 1;
    if (input.right) targetX += 1;
    if (input.up) targetY -= 1;
    if (input.down) targetY += 1;

    let targetVx = 0;
    let targetVy = 0;
    const targetLen = Math.hypot(targetX, targetY);
    if (targetLen > 0) {
      targetVx = (targetX / targetLen) * GOALIE_MAX_SPEED;
      targetVy = (targetY / targetLen) * GOALIE_MAX_SPEED;
    }

    // X axis acceleration / deceleration
    if (targetX !== 0) {
      const diff = targetVx - state.vel.x;
      const maxChange = GOALIE_ACCEL * dt;
      if (Math.abs(diff) <= maxChange) {
        state.vel.x = targetVx;
      } else {
        state.vel.x += Math.sign(diff) * maxChange;
      }
    } else {
      const maxChange = GOALIE_DECEL * dt;
      if (Math.abs(state.vel.x) <= maxChange) {
        state.vel.x = 0;
      } else {
        state.vel.x -= Math.sign(state.vel.x) * maxChange;
      }
    }

    // Y axis acceleration / deceleration
    if (targetY !== 0) {
      const diff = targetVy - state.vel.y;
      const maxChange = GOALIE_ACCEL * dt;
      if (Math.abs(diff) <= maxChange) {
        state.vel.y = targetVy;
      } else {
        state.vel.y += Math.sign(diff) * maxChange;
      }
    } else {
      const maxChange = GOALIE_DECEL * dt;
      if (Math.abs(state.vel.y) <= maxChange) {
        state.vel.y = 0;
      } else {
        state.vel.y -= Math.sign(state.vel.y) * maxChange;
      }
    }

    state.pos.x += state.vel.x * dt;
    state.pos.y += state.vel.y * dt;

    // Clamp position bounds: x in [50, 140], y in [50, 550]
    if (state.pos.x < 50) {
      state.pos.x = 50;
      if (state.vel.x < 0) state.vel.x = 0;
    }
    if (state.pos.x > 140) {
      state.pos.x = 140;
      if (state.vel.x > 0) state.vel.x = 0;
    }
    if (state.pos.y < 50) {
      state.pos.y = 50;
      if (state.vel.y < 0) state.vel.y = 0;
    }
    if (state.pos.y > 550) {
      state.pos.y = 550;
      if (state.vel.y > 0) state.vel.y = 0;
    }
  }

  // 5. Stance animation lerp
  const targetLerp = state.stance === GoalieStance.BUTTERFLY ? 1.0 : 0.0;
  const lerpFactor = 1 - Math.pow(1 - 0.15, 60 * dt);
  state.stanceLerp += (targetLerp - state.stanceLerp) * lerpFactor;
}

export function getHitboxes(state: GoalieState): Hitbox[] {
  const { pos, stance, stickPos } = state;

  switch (stance) {
    case GoalieStance.DESPERATION_DIVE:
      return [
        {
          a: { x: pos.x - 30, y: pos.y },
          b: { x: pos.x + 60, y: pos.y },
          radius: 24,
          kind: 'body',
        },
      ];

    case GoalieStance.POKE_CHECK:
      return [
        {
          a: { x: pos.x, y: pos.y },
          b: { x: pos.x, y: pos.y },
          radius: GOALIE_RADIUS,
          kind: 'body',
        },
        {
          a: { x: pos.x + 20, y: pos.y },
          b: { x: pos.x + 75, y: pos.y },
          radius: 16,
          kind: 'stick',
        },
      ];

    case GoalieStance.GLOVE_SNAG:
      return [
        {
          a: { x: pos.x, y: pos.y },
          b: { x: pos.x, y: pos.y },
          radius: GOALIE_RADIUS,
          kind: 'body',
        },
        {
          a: { x: pos.x + 20, y: pos.y },
          b: { x: pos.x + 20, y: pos.y },
          radius: 18,
          kind: 'stick',
        },
        {
          a: { x: pos.x - 20, y: pos.y - 45 },
          b: { x: pos.x + 20, y: pos.y - 45 },
          radius: 35,
          kind: 'glove',
        },
      ];

    case GoalieStance.BUTTERFLY:
      return [
        {
          a: { x: pos.x, y: pos.y + 15 },
          b: { x: pos.x, y: pos.y + 15 },
          radius: 18,
          kind: 'body',
        },
        {
          a: { x: pos.x - 40, y: pos.y + 30 },
          b: { x: pos.x + 40, y: pos.y + 30 },
          radius: 20,
          kind: 'butterfly',
        },
        {
          a: { x: pos.x + 15, y: pos.y + 35 },
          b: { x: pos.x + 35, y: pos.y + 35 },
          radius: 12,
          kind: 'stick',
        },
      ];

    case GoalieStance.STAND:
    default: {
      const hitboxes: Hitbox[] = [
        {
          a: { x: pos.x, y: pos.y },
          b: { x: pos.x, y: pos.y },
          radius: GOALIE_RADIUS,
          kind: 'body',
        },
      ];

      if (stickPos === StickPosition.UP) {
        hitboxes.push(
          {
            a: { x: pos.x + 20, y: pos.y - 35 },
            b: { x: pos.x + 20, y: pos.y - 35 },
            radius: 18,
            kind: 'stick',
          },
          {
            a: { x: pos.x - 15, y: pos.y - 42.5 },
            b: { x: pos.x + 15, y: pos.y - 42.5 },
            radius: 20,
            kind: 'glove',
          }
        );
      } else if (stickPos === StickPosition.DOWN) {
        hitboxes.push(
          {
            a: { x: pos.x + 20, y: pos.y + 35 },
            b: { x: pos.x + 20, y: pos.y + 35 },
            radius: 18,
            kind: 'stick',
          },
          {
            a: { x: pos.x - 40, y: pos.y + 30 },
            b: { x: pos.x + 40, y: pos.y + 30 },
            radius: 20,
            kind: 'butterfly',
          }
        );
      } else {
        hitboxes.push({
          a: { x: pos.x + 20, y: pos.y },
          b: { x: pos.x + 20, y: pos.y },
          radius: 18,
          kind: 'stick',
        });
      }

      return hitboxes;
    }
  }
}
