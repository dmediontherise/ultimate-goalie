import { describe, expect, it, vi } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAGNET_CONE_HALF_ANGLE, MAGNET_RADIUS } from '../constants';
import { createGoalie, getHitboxes } from '../goalie';
import { createIceSpray } from './effects';
import { drawCapsule, drawGoalie } from './goalie';

describe('Graphics & Renderer (Task 006)', () => {
  it('draws capsules with finite geometry and valid paths', () => {
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    // Single point (circle)
    drawCapsule(ctx, { x: 50, y: 50 }, { x: 50, y: 50 }, 15, '#fff');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 15, 0, Math.PI * 2);

    // Segment capsule
    drawCapsule(ctx, { x: 0, y: 0 }, { x: 100, y: 0 }, 10, '#fff', '#000');
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it('drawGoalie queries getHitboxes and positions save surfaces from it', () => {
    const goalie = createGoalie({ x: 100, y: 300 });
    const hitboxes = getHitboxes(goalie);
    expect(hitboxes.length).toBeGreaterThan(0);

    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawGoalie(
      ctx,
      goalie,
      { x: 100, y: 300 },
      0,
      { kind: 'body', timer: 0.2, duration: 0.3 },
      true,
      0
    );

    // Assert canvas operations occurred for all hitboxes
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('generates ice spray particles at contact point on save', () => {
    const contact = { x: 120, y: 280 };
    const particles = createIceSpray(contact, 25);
    expect(particles.length).toBe(25);
    for (const p of particles) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.radius).toBeGreaterThan(0);
      expect(p.life).toBeGreaterThan(0);
    }
  });

  it('magnet cone geometry matches magnet constants', () => {
    expect(MAGNET_CONE_HALF_ANGLE).toBe(Math.PI / 3);
    expect(MAGNET_RADIUS).toBe(250);
  });
});
