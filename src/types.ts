export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  ROUND_TRANSITION = 'ROUND_TRANSITION',
  ROUND_WON = 'ROUND_WON',
  ROUND_LOST = 'ROUND_LOST',
  GAME_OVER = 'GAME_OVER'
}

export type SaveType = 'body' | 'stick' | 'glove' | 'butterfly' | 'miss';

export enum StickPosition {
  UP = 'UP',
  STRAIGHT = 'STRAIGHT',
  DOWN = 'DOWN'
}

export enum GoalieStance {
  STAND = 'STAND',
  BUTTERFLY = 'BUTTERFLY',
  POKE_CHECK = 'POKE_CHECK',
  DESPERATION_DIVE = 'DESPERATION_DIVE',
  GLOVE_SNAG = 'GLOVE_SNAG'
}

export interface Hitbox {
  a: Vector2;
  b: Vector2;
  radius: number;
  kind: SaveType;
}

export interface MagnetState {
  charge: number;
  active: boolean;
}

export type ShotType = 'wrist' | 'snap' | 'slap';

export interface ShooterState {
  pos: Vector2;
  vel: Vector2;
  releaseDistance: number;
  shotType: ShotType;
  windUpDuration: number;
  windUpElapsed: number;
  isWindingUp: boolean;
  hasShot: boolean;
  isDeke: boolean;
  fakedTarget?: Vector2;
  currentTarget?: Vector2;
  finalTarget?: Vector2;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
}

export interface RoundConfig {
  roundNumber: number;
  shooterSpeed: number;
  shotSpeed: number;
  aiIntelligence: number;
  skill?: number;
  curveFactor: number;
  spin?: number;
  jitter: number;
  isSlapShot: boolean;
  hasPowerUp: boolean;
  hasMagnet: boolean;
}

export interface HudData {
  stamina: number;
  magnetCharge: number;
  hasMagnet: boolean;
  magnetActive: boolean;
  stance: GoalieStance;
  activeTimer: number;
  recoveryTimer: number;
  canPoke: boolean;
  canDive: boolean;
  canGloveSnag: boolean;
  pokeCost: number;
  diveCost: number;
  gloveCost: number;
  pokeCooldown: number;
  diveCooldown: number;
  gloveCooldown: number;
}

export type HudState = HudData;