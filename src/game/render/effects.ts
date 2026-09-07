import { Vector2 } from '../../types';
import {
  GOAL_TOP,
  GOAL_X,
  MAGNET_CONE_HALF_ANGLE,
  MAGNET_RADIUS,
  PUCK_RADIUS,
} from '../constants';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface ScreenShake {
  magnitude: number;
  duration: number;
  elapsed: number;
}

export interface GoalLight {
  active: boolean;
  timer: number;
  duration: number;
}

let fxRngState = 1234567;
function fxRng(): number {
  fxRngState = (fxRngState * 1664525 + 1013904223) >>> 0;
  return fxRngState / 4294967296;
}

export function createIceSpray(contactPoint: Vector2, count: number = 30): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (fxRng() - 0.5) * Math.PI * 1.6; // Spray outward
    const speed = 80 + fxRng() * 220;
    const life = 0.25 + fxRng() * 0.35;
    particles.push({
      x: contactPoint.x + (fxRng() - 0.5) * 6,
      y: contactPoint.y + (fxRng() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.2 + fxRng() * 2.2,
      color: fxRng() > 0.3 ? '#f8fafc' : '#bae6fd',
      alpha: 1.0,
      life,
      maxLife: life,
    });
  }
  return particles;
}

export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number
): Particle[] {
  const remaining: Particle[] = [];

  for (const p of particles) {
    p.life -= dt;
    if (p.life > 0) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // Slight gravity
      p.vx *= 0.95; // Ice drag
      p.alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      remaining.push(p);
    }
  }

  return remaining;
}

/**
 * Draws puck with dynamic velocity motion streak (Requirement 7).
 */
export function drawPuck(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  vel: Vector2,
  dt: number
): void {
  const speed = Math.hypot(vel.x, vel.y);

  // Dynamic motion streak
  if (speed > 40) {
    const streakLength = Math.min(80, speed * dt * 2.5);
    const dirX = vel.x / speed;
    const dirY = vel.y / speed;
    const tailX = pos.x - dirX * streakLength;
    const tailY = pos.y - dirY * streakLength;

    const streakGrad = ctx.createLinearGradient(pos.x, pos.y, tailX, tailY);
    streakGrad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
    streakGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.3)');
    streakGrad.addColorStop(1, 'rgba(51, 65, 85, 0)');

    ctx.strokeStyle = streakGrad;
    ctx.lineWidth = PUCK_RADIUS * 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }

  // Solid puck disc
  ctx.fillStyle = '#0f172a'; // Deep vulcanized rubber
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, PUCK_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Ice rim gloss highlight
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(pos.x - 1.5, pos.y - 1.5, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the active magnet field cone using MAGNET_CONE_HALF_ANGLE and MAGNET_RADIUS (Requirement 9).
 */
export function drawMagnetField(
  ctx: CanvasRenderingContext2D,
  goaliePos: Vector2,
  charge: number,
  frameCount: number
): void {
  const halfAngle = MAGNET_CONE_HALF_ANGLE;
  const radius = MAGNET_RADIUS;
  const pulse = Math.sin(frameCount * 0.2) * 0.15 + 0.85;

  ctx.save();

  // Magnetic cone fill gradient
  const coneGrad = ctx.createRadialGradient(
    goaliePos.x,
    goaliePos.y,
    0,
    goaliePos.x,
    goaliePos.y,
    radius
  );
  coneGrad.addColorStop(0, `rgba(56, 189, 248, ${0.28 * charge * pulse})`);
  coneGrad.addColorStop(0.6, `rgba(14, 165, 233, ${0.15 * charge * pulse})`);
  coneGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');

  // Cone geometry
  ctx.beginPath();
  ctx.moveTo(goaliePos.x, goaliePos.y);
  ctx.arc(goaliePos.x, goaliePos.y, radius, -halfAngle, halfAngle);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  // Electric boundary arc
  ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 * charge * pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Internal radial field lines
  const numRays = 7;
  ctx.strokeStyle = `rgba(186, 230, 253, ${0.25 * charge * pulse})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < numRays; i++) {
    const rayAngle = -halfAngle + (i / (numRays - 1)) * (2 * halfAngle);
    ctx.beginPath();
    ctx.moveTo(goaliePos.x, goaliePos.y);
    ctx.lineTo(
      goaliePos.x + Math.cos(rayAngle) * radius * 0.9,
      goaliePos.y + Math.sin(rayAngle) * radius * 0.9
    );
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the red goal siren / light when a goal is scored (Requirement 8).
 */
export function drawGoalLight(
  ctx: CanvasRenderingContext2D,
  goalLight: GoalLight,
  frameCount: number
): void {
  if (!goalLight.active || goalLight.timer <= 0) return;

  const lightX = GOAL_X - 12;
  const lightY = GOAL_TOP - 30;
  const progress = goalLight.timer / goalLight.duration;
  const pulse = Math.abs(Math.sin(frameCount * 0.3));

  ctx.save();

  // Glow halo
  const glowGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 60);
  glowGrad.addColorStop(0, `rgba(239, 68, 68, ${0.7 * progress * pulse})`);
  glowGrad.addColorStop(0.5, `rgba(220, 38, 38, ${0.3 * progress * pulse})`);
  glowGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(lightX, lightY, 60, 0, Math.PI * 2);
  ctx.fill();

  // Siren dome
  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lightX, lightY, 10, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // Strobe beacon beam
  const beamAngle = frameCount * 0.25;
  ctx.strokeStyle = `rgba(254, 202, 202, ${0.8 * progress})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lightX, lightY);
  ctx.lineTo(lightX + Math.cos(beamAngle) * 35, lightY + Math.sin(beamAngle) * 35);
  ctx.stroke();

  ctx.restore();
}
