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
  curveFactor: number;
  jitter: number;
  isSlapShot: boolean;
  hasPowerUp: boolean;
  hasMagnet: boolean;
}