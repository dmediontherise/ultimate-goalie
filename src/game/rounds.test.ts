import { describe, expect, it } from 'vitest';
import { getRoundConfig } from './rounds';
import { createShooter } from './shooter';

describe('Round progression and difficulty curves (Task 007)', () => {
  it('skill is non-decreasing across rounds 1 through 10 and round 1 < round 10 (Requirement 3)', () => {
    const configs = Array.from({ length: 10 }, (_, i) => getRoundConfig(i + 1));

    for (let i = 0; i < configs.length - 1; i++) {
      expect(configs[i + 1].skill).toBeGreaterThanOrEqual(configs[i].skill);
      expect(configs[i].skill).toBeGreaterThanOrEqual(0);
      expect(configs[i].skill).toBeLessThanOrEqual(1);
    }
    expect(configs[9].skill).toBeGreaterThanOrEqual(0);
    expect(configs[9].skill).toBeLessThanOrEqual(1);

    expect(configs[0].skill).toBeLessThan(configs[9].skill);
  });

  it('every field of getRoundConfig(n) is finite for n in 1..10 and function is total for 0, 11, 100 (Requirement 4)', () => {
    const testRounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 11, 100, -5];

    for (const r of testRounds) {
      expect(() => getRoundConfig(r)).not.toThrow();
      const config = getRoundConfig(r);

      expect(config).toBeDefined();
      expect(Number.isFinite(config.roundNumber)).toBe(true);
      expect(Number.isFinite(config.shooterSpeed)).toBe(true);
      expect(Number.isFinite(config.shotSpeed)).toBe(true);
      expect(Number.isFinite(config.aiIntelligence)).toBe(true);
      expect(Number.isFinite(config.skill)).toBe(true);
      expect(Number.isFinite(config.curveFactor)).toBe(true);
      expect(Number.isFinite(config.spin)).toBe(true);
      expect(Number.isFinite(config.jitter)).toBe(true);
      expect(typeof config.isSlapShot).toBe('boolean');
      expect(typeof config.hasPowerUp).toBe('boolean');
      expect(typeof config.hasMagnet).toBe('boolean');

      // Check range bounds
      expect(config.skill).toBeGreaterThanOrEqual(0);
      expect(config.skill).toBeLessThanOrEqual(1);
      expect(config.shotSpeed).toBeGreaterThan(0);
      expect(config.shooterSpeed).toBeGreaterThan(0);
    }
  });

  it('preserves special rounds: round 4 slap shots, round 7 heavy curve, round 9 speed boost, magnet rounds 5–10 (Requirement 5)', () => {
    // Round 4: Slap shots
    for (let r = 1; r <= 10; r++) {
      const config = getRoundConfig(r);
      if (r === 4) {
        expect(config.isSlapShot).toBe(true);
      } else {
        expect(config.isSlapShot).toBe(false);
      }
    }

    // Round 7: Heavy curve
    const r7 = getRoundConfig(7);
    expect(r7.curveFactor).toBe(1.5);

    // Round 9: Speed boost / power up
    for (let r = 1; r <= 10; r++) {
      const config = getRoundConfig(r);
      if (r === 9) {
        expect(config.hasPowerUp).toBe(true);
      } else {
        expect(config.hasPowerUp).toBe(false);
      }
    }

    // Rounds 5–10: Puck magnet available
    for (let r = 1; r <= 10; r++) {
      const config = getRoundConfig(r);
      if (r >= 5 && r <= 10) {
        expect(config.hasMagnet).toBe(true);
      } else {
        expect(config.hasMagnet).toBe(false);
      }
    }
  });

  it('difficulty rises smoothly: no single round-to-round increase in shotSpeed exceeds 25% of total range (Requirement 6)', () => {
    const configs = Array.from({ length: 10 }, (_, i) => getRoundConfig(i + 1));
    const speeds = configs.map(c => c.shotSpeed);

    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    const totalRange = maxSpeed - minSpeed;

    expect(totalRange).toBeGreaterThan(0);

    for (let i = 0; i < speeds.length - 1; i++) {
      const stepIncrease = speeds[i + 1] - speeds[i];
      // Must be smoothly rising
      expect(stepIncrease).toBeGreaterThanOrEqual(0);
      // No single increase exceeds 25% of total range
      expect(stepIncrease).toBeLessThanOrEqual(totalRange * 0.25);
    }
  });

  it('shooter AI consumes skill from getRoundConfig (Requirement 2)', () => {
    const configR1 = getRoundConfig(1);
    const configR10 = getRoundConfig(10);

    expect(configR1.skill).toBeDefined();
    expect(configR10.skill).toBeDefined();
    expect(configR1.skill).toBeGreaterThanOrEqual(0);
    expect(configR10.skill).toBeLessThanOrEqual(1);

    // Assert that getRoundConfig produces valid config accepted by createShooter and stepShooter
    const rng = () => 0.5;
    const shooterR1 = createShooter(configR1, rng);
    const shooterR10 = createShooter(configR10, rng);

    expect(shooterR1).toBeDefined();
    expect(shooterR10).toBeDefined();
    // High skill shooter releases closer to net than low skill shooter
    expect(shooterR10.releaseDistance).toBeLessThan(shooterR1.releaseDistance);
  });

  it('handles edge case inputs gracefully without throwing or returning NaN', () => {
    const edgeCases = [NaN, Infinity, -Infinity, 3.14159, -100, 1000000];

    for (const ec of edgeCases) {
      expect(() => getRoundConfig(ec)).not.toThrow();
      const cfg = getRoundConfig(ec);
      expect(Number.isFinite(cfg.shotSpeed)).toBe(true);
      expect(Number.isFinite(cfg.shooterSpeed)).toBe(true);
      expect(Number.isFinite(cfg.skill)).toBe(true);
      expect(cfg.skill).toBeGreaterThanOrEqual(0);
      expect(cfg.skill).toBeLessThanOrEqual(1);
    }
  });
});

