import { GoalieStance, Hitbox, SaveType, StickPosition, Vector2 } from '../../types';
import { getHitboxes, GoalieState } from '../goalie';

export interface SurfaceFlashState {
  kind: SaveType;
  timer: number;
  duration: number;
}

/**
 * Draws a geometric capsule defined by segment [a, b] and radius.
 */
export function drawCapsule(
  ctx: CanvasRenderingContext2D,
  a: Vector2,
  b: Vector2,
  radius: number,
  fill?: string,
  stroke?: string,
  lineWidth: number = 2
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  ctx.beginPath();
  if (len < 1e-4) {
    ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
  } else {
    const angle = Math.atan2(dy, dx);
    ctx.arc(b.x, b.y, radius, angle - Math.PI / 2, angle + Math.PI / 2);
    ctx.arc(a.x, a.y, radius, angle + Math.PI / 2, angle + (3 * Math.PI) / 2);
    ctx.closePath();
  }

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Renders the goalie directly from getHitboxes(goalie) plus continuous stanceLerp.
 */
export function drawGoalie(
  ctx: CanvasRenderingContext2D,
  goalie: GoalieState,
  renderPos: Vector2,
  renderStanceLerp: number,
  surfaceFlash?: SurfaceFlashState | null,
  debugHitboxes: boolean = false,
  frameCount: number = 0
): void {
  // Construct temporary goalie state with interpolated position and stance
  const visualGoalie: GoalieState = {
    ...goalie,
    pos: renderPos,
    stanceLerp: renderStanceLerp,
  };

  const hitboxes: Hitbox[] = getHitboxes(visualGoalie);
  const breath = Math.sin(frameCount * 0.1) * 1.5;

  // 1. Shadow underneath
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(
    renderPos.x,
    renderPos.y + 40 + renderStanceLerp * 5,
    30 + renderStanceLerp * 15,
    10,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Find the primary body hitbox for positioning decorative torso elements
  const bodyHitbox = hitboxes.find(h => h.kind === 'body') || hitboxes[0];
  const bodyCenter = {
    x: (bodyHitbox.a.x + bodyHitbox.b.x) / 2,
    y: (bodyHitbox.a.y + bodyHitbox.b.y) / 2,
  };

  // 2. Draw every save surface directly from its Hitbox
  for (const h of hitboxes) {
    const isFlashing =
      surfaceFlash &&
      surfaceFlash.kind === h.kind &&
      surfaceFlash.timer > 0;
    const flashProgress = isFlashing ? surfaceFlash.timer / surfaceFlash.duration : 0;

    switch (h.kind) {
      case 'body': {
        // Torso / chest protector
        const bodyFill = isFlashing
          ? `rgba(255, 255, 255, ${0.7 + 0.3 * flashProgress})`
          : '#1e3a8a'; // Royal navy jersey
        drawCapsule(ctx, h.a, h.b, h.radius, bodyFill, '#172554', 2.5);

        // Chest plate accent
        drawCapsule(ctx, h.a, h.b, h.radius * 0.75, '#2563eb');
        break;
      }

      case 'butterfly': {
        // Butterfly leg pad capsule
        const padFill = isFlashing
          ? `rgba(255, 255, 255, ${0.8 + 0.2 * flashProgress})`
          : '#f8fafc'; // Crisp goalie white pad
        drawCapsule(ctx, h.a, h.b, h.radius, padFill, '#334155', 2.5);

        // Knee rolls and pad channels
        const midX = (h.a.x + h.b.x) / 2;
        const midY = (h.a.y + h.b.y) / 2;
        ctx.strokeStyle = '#dc2626'; // Team red pad stripes
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(midX - 15, midY - 6); ctx.lineTo(midX - 15, midY + 6);
        ctx.moveTo(midX + 15, midY - 6); ctx.lineTo(midX + 15, midY + 6);
        ctx.stroke();
        break;
      }

      case 'stick': {
        // Stick paddle / blade
        const stickFill = isFlashing
          ? `rgba(255, 255, 255, ${0.8 + 0.2 * flashProgress})`
          : '#d97706'; // Wood composite amber
        drawCapsule(ctx, h.a, h.b, h.radius, stickFill, '#78350f', 2);

        // Blade tape accent
        const stickMidX = (h.a.x + h.b.x) / 2;
        const stickMidY = (h.a.y + h.b.y) / 2;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(stickMidX - 4, stickMidY - 3, 8, 6);
        break;
      }

      case 'glove': {
        // Trapper catching glove
        const gloveFill = isFlashing
          ? `rgba(255, 255, 255, ${0.8 + 0.2 * flashProgress})`
          : '#b91c1c'; // Trapper leather red
        drawCapsule(ctx, h.a, h.b, h.radius, gloveFill, '#7f1d1d', 2.5);

        // Glove pocket webbing
        const gCenterX = (h.a.x + h.b.x) / 2;
        const gCenterY = (h.a.y + h.b.y) / 2;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gCenterX, gCenterY, h.radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }

    // Impact flash aura bloom over the struck surface
    if (isFlashing) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18 * flashProgress;
      drawCapsule(ctx, h.a, h.b, h.radius + 3, `rgba(255, 255, 255, ${0.4 * flashProgress})`);
      ctx.restore();
    }
  }

  // 3. Purely decorative elements (helmet, cage, jersey logo, shoulders)
  // Shoulders
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(bodyCenter.x - 18, bodyCenter.y - 12 + breath, 11, 0, Math.PI * 2);
  ctx.arc(bodyCenter.x + 18, bodyCenter.y - 12 + breath, 11, 0, Math.PI * 2);
  ctx.fill();

  // Jersey Logo
  ctx.fillStyle = '#facc15'; // Gold crest
  ctx.beginPath();
  ctx.arc(bodyCenter.x, bodyCenter.y - 6 + breath, 7, 0, Math.PI * 2);
  ctx.fill();

  // Goalie Helmet
  const headY = bodyCenter.y - 25 + breath;
  ctx.fillStyle = '#f1f5f9'; // White composite shell
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bodyCenter.x, headY, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cage (Steel wire face protector)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bodyCenter.x - 7, headY - 4); ctx.lineTo(bodyCenter.x + 7, headY - 4);
  ctx.moveTo(bodyCenter.x - 7, headY + 1); ctx.lineTo(bodyCenter.x + 7, headY + 1);
  ctx.moveTo(bodyCenter.x - 3, headY - 8); ctx.lineTo(bodyCenter.x - 3, headY + 6);
  ctx.moveTo(bodyCenter.x + 3, headY - 8); ctx.lineTo(bodyCenter.x + 3, headY + 6);
  ctx.stroke();

  // 4. Debug Overlay (Requirement 4)
  if (debugHitboxes) {
    for (const h of hitboxes) {
      let debugColor = '#00e5ff'; // Body cyan
      if (h.kind === 'stick') debugColor = '#ffd600'; // Yellow
      if (h.kind === 'glove') debugColor = '#ff007f'; // Pink
      if (h.kind === 'butterfly') debugColor = '#00e676'; // Green

      // Outline capsule
      drawCapsule(ctx, h.a, h.b, h.radius, undefined, debugColor, 2);

      // Segment line
      ctx.strokeStyle = debugColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(h.a.x, h.a.y);
      ctx.lineTo(h.b.x, h.b.y);
      ctx.stroke();

      // Endpoint markers
      ctx.fillStyle = debugColor;
      ctx.beginPath();
      ctx.arc(h.a.x, h.a.y, 3, 0, Math.PI * 2);
      ctx.arc(h.b.x, h.b.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = debugColor;
      ctx.fillText(`${h.kind} r=${h.radius}`, h.a.x + 5, h.a.y - 5);
    }
  }
}
