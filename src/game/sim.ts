import { RoundConfig, SaveType, StickPosition, Vector2 } from '../types';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GOAL_BOTTOM,
  GOAL_TOP,
  GOAL_X,
  MAGNUS_ACCELERATION,
  PUCK_RADIUS,
} from './constants';
import { createGoalie, getHitboxes, GoalieInput, GoalieState, stepGoalie } from './goalie';
import { applyMagnet, createMagnet, MagnetState, stepMagnet } from './magnet';
import { sweptCircleCapsule } from './physics';
import { createRng } from './rng';
import { createShooter, chooseTarget, ShooterState, stepShooter } from './shooter';

export interface SimState {
  config: RoundConfig;
  goalie: GoalieState;
  magnet: MagnetState;
  shooter: ShooterState;
  goaliePos: Vector2;
  stickPos: StickPosition;
  stanceLerp: number;
  shooterPos: Vector2;
  puckPos: Vector2;
  puckVel: Vector2;
  puckSpin: number;
  spin: number;
  puckTrail: Vector2[];
  hasShot: boolean;
  roundEnded: boolean;
  windUpStart: number | null;
  shootThreshold: number;
  simTime: number;
  rng: () => number;
}

export interface SimInput extends GoalieInput {
  magnet?: boolean;
}

export interface RoundEndEvent {
  type: 'round-end';
  success: boolean;
  saveType?: SaveType;
}

export type SimEvent = RoundEndEvent;

export function createSim(config: RoundConfig, seed: number = 0): SimState {
  const rng = createRng(seed);
  const shootThreshold = 250 + rng() * 100;
  const initialShooterX = CANVAS_WIDTH - 100;
  const initialShooterY = CANVAS_HEIGHT / 2;

  const goalie = createGoalie({ x: 100, y: CANVAS_HEIGHT / 2 });
  const magnet = createMagnet();
  const shooter = createShooter(config, rng, { x: initialShooterX, y: initialShooterY });

  let _spin = 0;

  const sim: SimState = {
    config,
    goalie,
    magnet,
    shooter,
    get goaliePos() {
      return this.goalie.pos;
    },
    set goaliePos(p: Vector2) {
      this.goalie.pos = p;
    },
    get stickPos() {
      return this.goalie.stickPos;
    },
    set stickPos(s: StickPosition) {
      this.goalie.stickPos = s;
    },
    get stanceLerp() {
      return this.goalie.stanceLerp;
    },
    set stanceLerp(l: number) {
      this.goalie.stanceLerp = l;
    },
    get shooterPos() {
      return this.shooter.pos;
    },
    set shooterPos(p: Vector2) {
      this.shooter.pos = p;
    },
    get shootThreshold() {
      return this.shooter.releaseDistance;
    },
    set shootThreshold(t: number) {
      this.shooter.releaseDistance = t;
    },
    get windUpStart() {
      return this.shooter.isWindingUp ? this.simTime - this.shooter.windUpElapsed : null;
    },
    set windUpStart(w: number | null) {
      if (w === null) {
        this.shooter.isWindingUp = false;
        this.shooter.windUpElapsed = 0;
      } else {
        this.shooter.isWindingUp = true;
        this.shooter.windUpElapsed = this.simTime - w;
      }
    },
    puckPos: { x: initialShooterX - 20, y: initialShooterY },
    puckVel: { x: 0, y: 0 },
    puckSpin: 0,
    spin: 0,
    puckTrail: [],
    get hasShot() {
      return this.shooter.hasShot;
    },
    set hasShot(h: boolean) {
      this.shooter.hasShot = h;
    },
    roundEnded: false,
    simTime: 0,
    rng,
  };

  Object.defineProperty(sim, 'spin', {
    get: () => _spin,
    set: (val: number) => {
      _spin = val;
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(sim, 'puckSpin', {
    get: () => _spin,
    set: (val: number) => {
      _spin = val;
    },
    enumerable: true,
    configurable: true,
  });

  return sim;
}

function takeShot(state: SimState): void {
  state.hasShot = true;
  state.shooter.hasShot = true;
  const skill = state.config.skill ?? state.config.aiIntelligence ?? 0.5;
  const target = chooseTarget(state.goalie, skill, state.rng);

  const targetX = GOAL_X;
  const dx = targetX - state.puckPos.x;
  const dy = target.y - state.puckPos.y;
  const dist = Math.hypot(dx, dy);

  const speed = state.config.shotSpeed * 60;
  state.puckVel = {
    x: (dx / dist) * speed,
    y: (dy / dist) * speed,
  };

  if (state.spin === 0 && state.config.curveFactor !== 0) {
    const spinSign = state.rng() > 0.5 ? 1 : -1;
    state.spin = spinSign * state.config.curveFactor;
  }
}

function integratePuckAndCollide(state: SimState, dt: number): SimEvent[] {
  if (dt <= 0 || state.roundEnded) return [];

  const prevPos = { ...state.puckPos };

  // 1. Magnet effect
  if (state.config.hasMagnet) {
    state.magnet = state.magnet || createMagnet();
    state.puckVel = applyMagnet(
      { pos: state.puckPos, vel: state.puckVel },
      state.goalie,
      state.magnet,
      dt
    );
  }

  // 2. Magnus curve (direction changes, speed conserved)
  const curSpeed = Math.hypot(state.puckVel.x, state.puckVel.y);
  if (curSpeed > 1e-9 && state.spin !== 0) {
    const perpX = -state.puckVel.y / curSpeed;
    const perpY = state.puckVel.x / curSpeed;
    const accel = state.spin * MAGNUS_ACCELERATION;
    state.puckVel.x += perpX * accel * dt;
    state.puckVel.y += perpY * accel * dt;
    const newSpeed = Math.hypot(state.puckVel.x, state.puckVel.y);
    if (newSpeed > 1e-9) {
      state.puckVel.x = (state.puckVel.x / newSpeed) * curSpeed;
      state.puckVel.y = (state.puckVel.y / newSpeed) * curSpeed;
    }
  }

  const newPos = {
    x: prevPos.x + state.puckVel.x * dt,
    y: prevPos.y + state.puckVel.y * dt,
  };

  // 3. Swept collision detection against goalie hitboxes (earliest t wins)
  // Requirement 6: getHitboxes(state.goalie) is the ONLY definition of goalie collision geometry
  const hitboxes = getHitboxes(state.goalie);
  let bestHit: { t: number; point: Vector2; normal: Vector2; saveType: SaveType } | null = null;

  for (const hitbox of hitboxes) {
    const hit = sweptCircleCapsule(prevPos, newPos, PUCK_RADIUS, hitbox.a, hitbox.b, hitbox.radius);
    if (hit !== null && (!bestHit || hit.t < bestHit.t)) {
      bestHit = { ...hit, saveType: hitbox.kind };
    }
  }

  // 4. Goal line crossing
  let tGoal: number | null = null;
  const goalLineX = GOAL_X + 5;
  if (prevPos.x >= goalLineX && newPos.x < goalLineX) {
    tGoal = (prevPos.x - goalLineX) / (prevPos.x - newPos.x);
  } else if (newPos.x < goalLineX && prevPos.x < goalLineX) {
    tGoal = 0;
  }

  if (bestHit !== null && (tGoal === null || bestHit.t <= tGoal)) {
    state.roundEnded = true;
    state.puckPos = {
      x: prevPos.x + bestHit.t * (newPos.x - prevPos.x),
      y: prevPos.y + bestHit.t * (newPos.y - prevPos.y),
    };
    state.puckTrail.push({ ...state.puckPos });
    if (state.puckTrail.length > 15) state.puckTrail.shift();
    return [{ type: 'round-end', success: true, saveType: bestHit.saveType }];
  }

  if (tGoal !== null) {
    state.roundEnded = true;
    const yGoal = prevPos.y + tGoal * (newPos.y - prevPos.y);
    state.puckPos = { x: goalLineX, y: yGoal };
    state.puckTrail.push({ ...state.puckPos });
    if (state.puckTrail.length > 15) state.puckTrail.shift();
    if (yGoal > GOAL_TOP && yGoal < GOAL_BOTTOM) {
      return [{ type: 'round-end', success: false }];
    } else {
      return [{ type: 'round-end', success: true, saveType: 'miss' }];
    }
  }

  // 5. Out of bounds
  // Only the vertical edges are checked here. A puck with newPos.x < 0 can never
  // reach this point: goalLineX = GOAL_X + 5 = 45, so newPos.x < 0 implies
  // newPos.x < goalLineX, and whichever side prevPos.x falls on, one of the two
  // goal-line branches above sets tGoal and returns first.
  if (newPos.y < 0 || newPos.y > CANVAS_HEIGHT) {
    state.roundEnded = true;
    state.puckPos = newPos;
    state.puckTrail.push({ ...state.puckPos });
    if (state.puckTrail.length > 15) state.puckTrail.shift();
    return [{ type: 'round-end', success: true, saveType: 'miss' }];
  }

  state.puckPos = newPos;
  state.puckTrail.push({ ...state.puckPos });
  if (state.puckTrail.length > 15) {
    state.puckTrail.shift();
  }
  return [];
}

export function step(state: SimState, input?: SimInput, dt: number = 1 / 120): SimEvent[] {
  if (state.roundEnded) {
    return [];
  }

  // 1. Goalie update
  stepGoalie(state.goalie, input || {}, dt);

  // 2. Magnet update
  state.magnet = state.magnet || createMagnet();
  stepMagnet(state.magnet, state.config.hasMagnet && !!input?.magnet, dt);

  // 3. Shooter AI and Puck Integration
  if (!state.hasShot) {
    const skill = state.config.skill ?? state.config.aiIntelligence ?? 0.5;
    const result = stepShooter(
      state.shooter,
      state.goalie,
      skill,
      state.rng,
      dt,
      state.config,
      state.simTime
    );

    state.puckPos.x = state.shooter.pos.x - 20;
    state.puckPos.y = state.shooter.pos.y;

    if (result.shotReleased) {
      state.hasShot = true;
      state.puckVel = result.puckVel!;
      state.spin = result.spin!;
      state.simTime += dt;
      return integratePuckAndCollide(state, result.dtRemaining ?? 0);
    }

    state.simTime += dt;
    return [];
  } else {
    // Shot already released: integrate puck and check swept collision
    const events = integratePuckAndCollide(state, dt);
    state.simTime += dt;
    return events;
  }
}
