import { GoalieStance, Hitbox, SaveType, StickPosition, Vector2 } from '../../types';
import { getHitboxes, GoalieState } from '../goalie';

export interface SurfaceFlashState {
  kind: SaveType;
  timer: number;
  duration: number;
}

/** Team palette, kept in one place so the figure reads as one kit. */
const KIT = {
  jersey: '#1e3a8a',
  jerseyLight: '#2b52b8',
  jerseyDark: '#152a63',
  pad: '#f4f7fb',
  padShade: '#d7dfea',
  padStripe: '#dc2626',
  leather: '#b91c1c',
  leatherDark: '#7f1d1d',
  stick: '#c8873a',
  stickDark: '#7c4a12',
  tape: '#f8fafc',
  helmet: '#eef2f7',
  cage: '#3f4a5a',
  outline: '#101828',
  skate: '#1f2937',
  crest: '#facc15',
};

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

/** Rounded rectangle centred on (cx, cy), used for pads and the blocker. */
function roundedBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number
): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function centreOf(h: Hitbox): Vector2 {
  return { x: (h.a.x + h.b.x) / 2, y: (h.a.y + h.b.y) / 2 };
}

/** A leg pad: white face, vertical channels, two team stripes. */
function drawPad(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  flash: number
): void {
  roundedBox(ctx, cx, cy, w, h, 6);
  ctx.fillStyle = flash > 0 ? `rgba(255,255,255,${0.75 + 0.25 * flash})` : KIT.pad;
  ctx.fill();
  ctx.strokeStyle = KIT.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  roundedBox(ctx, cx, cy, w, h, 6);
  ctx.clip();

  // Knee-roll channels along the long axis.
  ctx.strokeStyle = KIT.padShade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (w >= h) {
    ctx.moveTo(cx - w / 2, cy - h / 6);
    ctx.lineTo(cx + w / 2, cy - h / 6);
    ctx.moveTo(cx - w / 2, cy + h / 6);
    ctx.lineTo(cx + w / 2, cy + h / 6);
  } else {
    ctx.moveTo(cx - w / 6, cy - h / 2);
    ctx.lineTo(cx - w / 6, cy + h / 2);
    ctx.moveTo(cx + w / 6, cy - h / 2);
    ctx.lineTo(cx + w / 6, cy + h / 2);
  }
  ctx.stroke();

  // Team stripes across the pad.
  ctx.fillStyle = KIT.padStripe;
  if (w >= h) {
    ctx.fillRect(cx - w * 0.22, cy - h / 2, 5, h);
    ctx.fillRect(cx + w * 0.14, cy - h / 2, 5, h);
  } else {
    ctx.fillRect(cx - w / 2, cy - h * 0.22, w, 5);
    ctx.fillRect(cx - w / 2, cy + h * 0.14, w, 5);
  }
  ctx.restore();
}

/**
 * Renders the goalie from getHitboxes(goalie) plus continuous stanceLerp.
 *
 * Every save surface is still positioned from hitbox data - that is the
 * invariant that keeps what you see and what you collide with identical. What
 * changed is that a hitbox is no longer drawn AS a bare capsule: a degenerate
 * point-hitbox (the standing body and stick are a === b) rendered as a plain
 * disc, so the figure came out as a pile of overlapping circles. Each surface
 * now draws the piece of equipment that occupies it, and the whole figure is
 * composed back-to-front rather than in hitbox-array order.
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
  const visualGoalie: GoalieState = {
    ...goalie,
    pos: renderPos,
    stanceLerp: renderStanceLerp,
  };

  const hitboxes: Hitbox[] = getHitboxes(visualGoalie);
  const breath = Math.sin(frameCount * 0.1) * 1.2;
  const t = Math.max(0, Math.min(1, renderStanceLerp));

  const flashFor = (kind: SaveType): number => {
    if (!surfaceFlash || surfaceFlash.kind !== kind || surfaceFlash.timer <= 0) return 0;
    return surfaceFlash.timer / surfaceFlash.duration;
  };

  const body = hitboxes.find(h => h.kind === 'body') ?? hitboxes[0];
  const butterfly = hitboxes.find(h => h.kind === 'butterfly');
  const stick = hitboxes.find(h => h.kind === 'stick');
  const glove = hitboxes.find(h => h.kind === 'glove');
  const bodyC = centreOf(body);

  // The goalie faces the shooter, who is always to the right.
  const torsoY = bodyC.y - 6 + breath;
  const headY = torsoY - 26;

  ctx.save();

  // ---- 1. Shadow -----------------------------------------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(bodyC.x, bodyC.y + 40, 30 + t * 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 2. Leg pads (behind the torso) --------------------------------------
  const padFlash = flashFor('butterfly');
  if (butterfly) {
    // Butterfly: the pads splay along the hitbox segment, so the white wall the
    // player sees is exactly the capsule the puck tests against.
    const bc = centreOf(butterfly);
    const halfLen = Math.hypot(butterfly.b.x - butterfly.a.x, butterfly.b.y - butterfly.a.y) / 2;
    const padH = butterfly.radius * 1.7;
    const padW = halfLen + butterfly.radius * 0.8;
    drawPad(ctx, bc.x - halfLen / 2 - 2, bc.y, padW, padH, padFlash);
    drawPad(ctx, bc.x + halfLen / 2 + 2, bc.y, padW, padH, padFlash);
  } else {
    // Standing: two upright pads straddling the body hitbox.
    const padW = 17;
    const padH = 46 - t * 10;
    const padY = bodyC.y + 16;
    drawPad(ctx, bodyC.x - 12, padY, padW, padH, padFlash);
    drawPad(ctx, bodyC.x + 12, padY, padW, padH, padFlash);

    // Skate blades peeking below the pads.
    ctx.fillStyle = KIT.skate;
    roundedBox(ctx, bodyC.x - 12, padY + padH / 2 + 3, padW - 2, 6, 2);
    ctx.fill();
    roundedBox(ctx, bodyC.x + 12, padY + padH / 2 + 3, padW - 2, 6, 2);
    ctx.fill();
  }

  // ---- 3. Torso ------------------------------------------------------------
  const bodyFlash = flashFor('body');
  const shoulderW = body.radius * 2.1;
  const torsoH = 40 - t * 12;

  ctx.beginPath();
  ctx.moveTo(bodyC.x - shoulderW / 2, torsoY - torsoH / 2 + 6);
  ctx.quadraticCurveTo(bodyC.x, torsoY - torsoH / 2 - 5, bodyC.x + shoulderW / 2, torsoY - torsoH / 2 + 6);
  ctx.lineTo(bodyC.x + shoulderW / 2 - 3, torsoY + torsoH / 2);
  ctx.quadraticCurveTo(bodyC.x, torsoY + torsoH / 2 + 6, bodyC.x - shoulderW / 2 + 3, torsoY + torsoH / 2);
  ctx.closePath();
  ctx.fillStyle = bodyFlash > 0 ? `rgba(255,255,255,${0.7 + 0.3 * bodyFlash})` : KIT.jersey;
  ctx.fill();
  ctx.strokeStyle = KIT.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chest protector highlight and crest.
  ctx.fillStyle = KIT.jerseyLight;
  roundedBox(ctx, bodyC.x, torsoY - 2, shoulderW * 0.52, torsoH * 0.5, 5);
  ctx.fill();
  ctx.fillStyle = KIT.crest;
  ctx.beginPath();
  ctx.arc(bodyC.x, torsoY - 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Shoulder caps.
  ctx.fillStyle = KIT.jerseyDark;
  ctx.beginPath();
  ctx.ellipse(bodyC.x - shoulderW / 2 + 2, torsoY - torsoH / 2 + 8, 7, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(bodyC.x + shoulderW / 2 - 2, torsoY - torsoH / 2 + 8, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 4. Stick: shaft from the blocker hand down to a blade on the ice ----
  if (stick) {
    const sc = centreOf(stick);
    const stickFlash = flashFor('stick');
    const gripX = bodyC.x + shoulderW / 2 - 2;
    const gripY = torsoY + 2;

    // Shaft
    ctx.strokeStyle = stickFlash > 0 ? '#ffffff' : KIT.stick;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(sc.x + 2, sc.y - stick.radius * 0.2);
    ctx.stroke();

    // Paddle + blade, sized to the hitbox it must cover.
    const bladeW = stick.radius * 1.35;
    const bladeH = stick.radius * 1.7;
    roundedBox(ctx, sc.x, sc.y, bladeW, bladeH, 4);
    ctx.fillStyle = stickFlash > 0 ? `rgba(255,255,255,${0.8 + 0.2 * stickFlash})` : KIT.stick;
    ctx.fill();
    ctx.strokeStyle = KIT.stickDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tape wrap
    ctx.fillStyle = KIT.tape;
    ctx.fillRect(sc.x - bladeW / 2 + 2, sc.y - 3, bladeW - 4, 6);

    // Blocker pad on the stick hand
    ctx.fillStyle = KIT.leather;
    roundedBox(ctx, gripX + 4, gripY - 4, 15, 20, 3);
    ctx.fill();
    ctx.strokeStyle = KIT.leatherDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ---- 5. Trapper ----------------------------------------------------------
  if (glove) {
    const gloveFlash = flashFor('glove');

    // The glove hitbox is a wide capsule; its centre sits directly over the
    // helmet, so drawing the trapper there hides the head behind a red disc.
    // Anchor it at the shooter-facing end instead - still inside the hitbox,
    // and where a raised glove save actually is.
    const gc = glove.b.x >= glove.a.x ? glove.b : glove.a;

    // Faint sweep showing the rest of the capsule the glove really covers.
    drawCapsule(
      ctx,
      glove.a,
      glove.b,
      glove.radius * 0.8,
      `rgba(185,28,28,${0.16 + 0.12 * gloveFlash})`
    );

    // Arm to the trapper
    ctx.strokeStyle = KIT.jersey;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bodyC.x - shoulderW / 2 + 2, torsoY);
    ctx.quadraticCurveTo(bodyC.x - shoulderW / 2 - 4, gc.y + 10, gc.x, gc.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gc.x, gc.y, glove.radius * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = gloveFlash > 0 ? `rgba(255,255,255,${0.8 + 0.2 * gloveFlash})` : KIT.leather;
    ctx.fill();
    ctx.strokeStyle = KIT.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pocket webbing
    ctx.strokeStyle = KIT.tape;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gc.x, gc.y, glove.radius * 0.45, Math.PI * 0.15, Math.PI * 1.15);
    ctx.stroke();
  }

  // ---- 6. Helmet and cage (always on top) ----------------------------------
  ctx.beginPath();
  ctx.arc(bodyC.x, headY, 12, 0, Math.PI * 2);
  ctx.fillStyle = KIT.helmet;
  ctx.fill();
  ctx.strokeStyle = KIT.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cage covers the shooter-facing half only, so the helmet still reads as a head.
  ctx.save();
  ctx.beginPath();
  ctx.arc(bodyC.x, headY, 12, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = KIT.cage;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = -8; i <= 8; i += 4) {
    ctx.moveTo(bodyC.x - 2, headY + i);
    ctx.lineTo(bodyC.x + 13, headY + i);
  }
  for (let i = 2; i <= 12; i += 5) {
    ctx.moveTo(bodyC.x + i, headY - 12);
    ctx.lineTo(bodyC.x + i, headY + 12);
  }
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // ---- 7. Impact bloom over whichever surface was struck --------------------
  if (surfaceFlash && surfaceFlash.timer > 0) {
    const struck = hitboxes.find(h => h.kind === surfaceFlash.kind);
    if (struck) {
      const p = surfaceFlash.timer / surfaceFlash.duration;
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18 * p;
      drawCapsule(ctx, struck.a, struck.b, struck.radius + 3, `rgba(255,255,255,${0.35 * p})`);
      ctx.restore();
    }
  }

  // ---- 8. Debug overlay: the true hitboxes, unchanged ----------------------
  if (debugHitboxes) {
    for (const h of hitboxes) {
      let debugColor = '#00e5ff';
      if (h.kind === 'stick') debugColor = '#ffd600';
      if (h.kind === 'glove') debugColor = '#ff007f';
      if (h.kind === 'butterfly') debugColor = '#00e676';

      drawCapsule(ctx, h.a, h.b, h.radius, undefined, debugColor, 2);

      ctx.strokeStyle = debugColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(h.a.x, h.a.y);
      ctx.lineTo(h.b.x, h.b.y);
      ctx.stroke();

      ctx.fillStyle = debugColor;
      ctx.beginPath();
      ctx.arc(h.a.x, h.a.y, 3, 0, Math.PI * 2);
      ctx.arc(h.b.x, h.b.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = debugColor;
      ctx.fillText(`${h.kind} r=${h.radius}`, h.a.x + 5, h.a.y - 5);
    }
  }
}
