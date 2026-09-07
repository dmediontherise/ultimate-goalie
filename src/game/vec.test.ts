import { describe, expect, it } from 'vitest';
import { add, dist, dot, len, norm, scale, sub } from './vec';

describe('Vector operations (Requirement 2)', () => {
  it('adds two vectors correctly', () => {
    const v = add({ x: 3, y: 4 }, { x: 1, y: 2 });
    expect(v).toEqual({ x: 4, y: 6 });
  });

  it('subtracts two vectors correctly', () => {
    const v = sub({ x: 10, y: 20 }, { x: 4, y: 6 });
    expect(v).toEqual({ x: 6, y: 14 });
  });

  it('scales a vector by a scalar', () => {
    const v = scale({ x: 2, y: -5 }, 3);
    expect(v).toEqual({ x: 6, y: -15 });
  });

  it('calculates the length of a vector', () => {
    expect(len({ x: 3, y: 4 })).toBe(5);
    expect(len({ x: 0, y: 0 })).toBe(0);
  });

  it('normalizes a non-zero vector to unit length', () => {
    const n = norm({ x: 0, y: 10 });
    expect(n.x).toBe(0);
    expect(n.y).toBe(1);
    expect(len(n)).toBeCloseTo(1);
  });

  it('norm of a zero vector returns {x: 0, y: 0} rather than NaN', () => {
    const zero = norm({ x: 0, y: 0 });
    expect(zero).toEqual({ x: 0, y: 0 });
    expect(Number.isNaN(zero.x)).toBe(false);
    expect(Number.isNaN(zero.y)).toBe(false);
  });

  it('calculates dot product correctly', () => {
    expect(dot({ x: 2, y: 3 }, { x: 4, y: -1 })).toBe(5);
  });

  it('calculates euclidean distance between two vectors', () => {
    expect(dist({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });
});
