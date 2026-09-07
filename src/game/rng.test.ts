import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('Mulberry32 RNG (Requirement 3)', () => {
  it('produces values in [0, 1)', () => {
    const rng = createRng(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('two generators built from the same seed produce identical sequences', () => {
    const rng1 = createRng(99999);
    const rng2 = createRng(99999);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(84);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});
