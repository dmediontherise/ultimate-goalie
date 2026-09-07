import { RoundConfig } from '../types';

/**
 * Pure function to calculate round configuration for any round number.
 * Total function: valid configuration returned for all integer values without throwing.
 *
 * Difficulty progression:
 * - Rounds 1 to 10 scale smoothly across skill, shot speed, shooter speed, and jitter.
 * - Special rounds:
 *   - Round 4: Slap Shots (isSlapShot = true)
 *   - Round 5–10: Puck Magnet available (hasMagnet = true)
 *   - Round 7: Heavy Curve (curveFactor = 1.5)
 *   - Round 9: Speed Boost (hasPowerUp = true)
 */
export function getRoundConfig(round: number): RoundConfig & { skill: number; spin: number } {
  const roundNum = Number.isFinite(round) ? Math.floor(round) : 1;
  const clampedRound = Math.max(1, Math.min(10, roundNum));
  const ratio = (clampedRound - 1) / 9; // 0 to 1 across rounds 1..10

  // Shot speed scales smoothly from 8 to 20 without step spikes
  const shotSpeed = 8 + ratio * 12;

  // Shooter approach speed scales from 2 to 6
  const shooterSpeed = 2 + ratio * 4;

  // Special round flags
  const isSlapShot = roundNum === 4;
  const hasPowerUp = roundNum === 9;
  const hasMagnet = roundNum >= 5 && roundNum <= 10;

  // Curve factor: starts curving from round 5 onwards; round 7 has heavy curve
  let curveFactor = 0;
  if (roundNum === 7) {
    curveFactor = 1.5;
  } else if (ratio > 0.5) {
    curveFactor = (ratio - 0.5) * 2;
  }

  // Shooter skill value in [0, 1] consumed by shooter.ts
  // Monotonically non-decreasing from 0.1 at round 1 to 0.95 at round 10
  const skill = 0.1 + ratio * 0.85;

  return {
    roundNumber: roundNum,
    shooterSpeed,
    shotSpeed,
    aiIntelligence: skill,
    skill,
    curveFactor,
    spin: curveFactor,
    jitter: ratio * 0.8,
    isSlapShot,
    hasPowerUp,
    hasMagnet,
  };
}
