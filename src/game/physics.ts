import { Vector2 } from '../types';
import { dist, dot, len, norm, scale, sub } from './vec';

export interface HitResult {
  t: number;
  point: Vector2;
  normal: Vector2;
}

export function sweptCircleCircle(
  from: Vector2,
  to: Vector2,
  radius: number,
  center: Vector2,
  otherRadius: number
): HitResult | null {
  const d = sub(to, from);
  const v = sub(from, center);
  const R = radius + otherRadius;

  const distSq0 = dot(v, v);
  if (distSq0 <= R * R) {
    const d0 = Math.sqrt(distSq0);
    const motionLen = len(d);
    const n = d0 > 1e-9 ? norm(v) : (motionLen > 1e-9 ? norm(scale(d, -1)) : { x: -1, y: 0 });
    return {
      t: 0,
      point: { x: center.x + n.x * otherRadius, y: center.y + n.y * otherRadius },
      normal: n,
    };
  }

  const A = dot(d, d);
  if (A < 1e-12) {
    return null;
  }

  const B = 2 * dot(v, d);
  const C = distSq0 - R * R;
  const disc = B * B - 4 * A * C;
  if (disc < 0) {
    return null;
  }

  const sqrtDisc = Math.sqrt(disc);
  const t = (-B - sqrtDisc) / (2 * A);
  if (t < 0 || t > 1) {
    return null;
  }

  const hitPos = { x: from.x + t * d.x, y: from.y + t * d.y };
  const n = norm(sub(hitPos, center));

  return {
    t,
    point: { x: center.x + n.x * otherRadius, y: center.y + n.y * otherRadius },
    normal: n,
  };
}

export function sweptCircleCapsule(
  from: Vector2,
  to: Vector2,
  radius: number,
  a: Vector2,
  b: Vector2,
  capsuleRadius: number
): HitResult | null {
  const u = sub(b, a);
  const L = len(u);

  if (L < 1e-9) {
    return sweptCircleCircle(from, to, radius, a, capsuleRadius);
  }

  const uHat = { x: u.x / L, y: u.y / L };
  // Normal pointing 90 deg counter-clockwise from uHat
  const nHat = { x: -uHat.y, y: uHat.x };
  const R = radius + capsuleRadius;

  // Check if starting position overlaps capsule
  const v0 = sub(from, a);
  const proj0 = Math.max(0, Math.min(L, dot(v0, uHat)));
  const c0 = { x: a.x + uHat.x * proj0, y: a.y + uHat.y * proj0 };
  const dist0 = dist(from, c0);

  if (dist0 <= R) {
    const n = dist0 > 1e-9 ? norm(sub(from, c0)) : { x: -uHat.x, y: -uHat.y };
    return {
      t: 0,
      point: { x: c0.x + n.x * capsuleRadius, y: c0.y + n.y * capsuleRadius },
      normal: n,
    };
  }

  const d = sub(to, from);
  let bestHit: HitResult | null = null;

  // 1. Cap A
  const hitA = sweptCircleCircle(from, to, radius, a, capsuleRadius);
  if (hitA !== null) {
    const hitPos = { x: from.x + hitA.t * d.x, y: from.y + hitA.t * d.y };
    const proj = dot(sub(hitPos, a), uHat);
    if (proj <= 1e-7) {
      bestHit = hitA;
    }
  }

  // 2. Cap B
  const hitB = sweptCircleCircle(from, to, radius, b, capsuleRadius);
  if (hitB !== null) {
    const hitPos = { x: from.x + hitB.t * d.x, y: from.y + hitB.t * d.y };
    const proj = dot(sub(hitPos, a), uHat);
    if (proj >= L - 1e-7) {
      if (!bestHit || hitB.t < bestHit.t) {
        bestHit = hitB;
      }
    }
  }

  // 3. Side 1: parallel line at +R * nHat
  const dDotN = dot(d, nHat);
  const v0DotN = dot(v0, nHat);

  if (dDotN < -1e-9) {
    const t1 = (R - v0DotN) / dDotN;
    if (t1 >= 0 && t1 <= 1 && (!bestHit || t1 < bestHit.t)) {
      const hitPos = { x: from.x + t1 * d.x, y: from.y + t1 * d.y };
      const proj = dot(sub(hitPos, a), uHat);
      if (proj >= -1e-7 && proj <= L + 1e-7) {
        const clampedProj = Math.max(0, Math.min(L, proj));
        bestHit = {
          t: t1,
          point: {
            x: a.x + uHat.x * clampedProj + nHat.x * capsuleRadius,
            y: a.y + uHat.y * clampedProj + nHat.y * capsuleRadius,
          },
          normal: nHat,
        };
      }
    }
  }

  // 4. Side 2: parallel line at -R * nHat
  if (dDotN > 1e-9) {
    const t2 = (-R - v0DotN) / dDotN;
    if (t2 >= 0 && t2 <= 1 && (!bestHit || t2 < bestHit.t)) {
      const hitPos = { x: from.x + t2 * d.x, y: from.y + t2 * d.y };
      const proj = dot(sub(hitPos, a), uHat);
      if (proj >= -1e-7 && proj <= L + 1e-7) {
        const clampedProj = Math.max(0, Math.min(L, proj));
        bestHit = {
          t: t2,
          point: {
            x: a.x + uHat.x * clampedProj - nHat.x * capsuleRadius,
            y: a.y + uHat.y * clampedProj - nHat.y * capsuleRadius,
          },
          normal: { x: -nHat.x, y: -nHat.y },
        };
      }
    }
  }

  return bestHit;
}

export function sweptCircleAABB(
  from: Vector2,
  to: Vector2,
  radius: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): HitResult | null {
  // Check if starting position is already inside expanded AABB
  if (
    from.x >= minX - radius &&
    from.x <= maxX + radius &&
    from.y >= minY - radius &&
    from.y <= maxY + radius
  ) {
    // Check if within corner radius
    const clampedX = Math.max(minX, Math.min(maxX, from.x));
    const clampedY = Math.max(minY, Math.min(maxY, from.y));
    const d = dist(from, { x: clampedX, y: clampedY });
    if (d <= radius) {
      const n = d > 1e-9 ? norm({ x: from.x - clampedX, y: from.y - clampedY }) : { x: 1, y: 0 };
      return {
        t: 0,
        point: { x: clampedX, y: clampedY },
        normal: n,
      };
    }
  }

  const p1 = { x: minX, y: minY };
  const p2 = { x: maxX, y: minY };
  const p3 = { x: maxX, y: maxY };
  const p4 = { x: minX, y: maxY };

  const edges: [Vector2, Vector2][] = [
    [p1, p2],
    [p2, p3],
    [p3, p4],
    [p4, p1],
  ];

  let earliest: HitResult | null = null;
  for (const [ea, eb] of edges) {
    const hit = sweptCircleCapsule(from, to, radius, ea, eb, 0);
    if (hit !== null && (!earliest || hit.t < earliest.t)) {
      earliest = hit;
    }
  }

  return earliest;
}
