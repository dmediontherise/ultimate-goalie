import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GOAL_BOTTOM,
  GOAL_TOP,
  GOAL_X,
} from '../constants';

export interface NetRippleState {
  amplitude: number;
  timer: number;
  duration: number;
}

export function drawIce(
  ctx: CanvasRenderingContext2D,
  netRipple?: NetRippleState | null
): void {
  // 1. Ice Surface with subtle gradient and gloss
  const iceGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  iceGrad.addColorStop(0, '#e2e8f0');
  iceGrad.addColorStop(0.2, '#f8fafc');
  iceGrad.addColorStop(0.5, '#f1f5f9');
  iceGrad.addColorStop(0.8, '#f8fafc');
  iceGrad.addColorStop(1, '#e2e8f0');

  ctx.fillStyle = iceGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle ice skate scratch marks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, 100); ctx.lineTo(280, 160);
  ctx.moveTo(120, 480); ctx.lineTo(310, 420);
  ctx.moveTo(350, 250); ctx.lineTo(520, 290);
  ctx.moveTo(400, 120); ctx.lineTo(560, 80);
  ctx.moveTo(450, 520); ctx.lineTo(620, 480);
  ctx.stroke();

  // 2. Rink Boards (Outer rounded border)
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1e293b'; // Slate outer boards
  ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ef4444'; // Red kickplate / board lining
  ctx.strokeRect(5, 5, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10);

  // 3. Faceoff circles & dots
  const faceoffDots = [
    { x: CANVAS_WIDTH - 180, y: 150 },
    { x: CANVAS_WIDTH - 180, y: CANVAS_HEIGHT - 150 },
  ];

  for (const dot of faceoffDots) {
    // Outer circle
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 85, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hash marks
    ctx.beginPath();
    ctx.moveTo(dot.x - 85, dot.y - 12); ctx.lineTo(dot.x - 85, dot.y + 12);
    ctx.moveTo(dot.x + 85, dot.y - 12); ctx.lineTo(dot.x + 85, dot.y + 12);
    ctx.stroke();
  }

  // 4. Goal Crease
  const creaseCenterY = (GOAL_TOP + GOAL_BOTTOM) / 2;
  const creaseRadius = 65;

  ctx.fillStyle = 'rgba(186, 230, 253, 0.45)'; // Crease ice blue
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(GOAL_X, creaseCenterY, creaseRadius, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  // Red crease base line
  ctx.beginPath();
  ctx.moveTo(GOAL_X, creaseCenterY - creaseRadius);
  ctx.lineTo(GOAL_X, creaseCenterY + creaseRadius);
  ctx.stroke();

  // 5. Goal Line
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(GOAL_X, 0);
  ctx.lineTo(GOAL_X, CANVAS_HEIGHT);
  ctx.stroke();

  // 6. Net drawn with 3D Depth and Ripple
  const netDepth = 34;
  const backX = GOAL_X - netDepth;
  let rippleWave = 0;
  if (netRipple && netRipple.timer < netRipple.duration) {
    const progress = netRipple.timer / netRipple.duration;
    rippleWave = Math.sin(progress * Math.PI * 8) * netRipple.amplitude * (1 - progress);
  }

  // Net interior shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.beginPath();
  ctx.moveTo(GOAL_X, GOAL_TOP);
  ctx.lineTo(backX - rippleWave, GOAL_TOP + 12);
  ctx.lineTo(backX - rippleWave, GOAL_BOTTOM - 12);
  ctx.lineTo(GOAL_X, GOAL_BOTTOM);
  ctx.closePath();
  ctx.fill();

  // Netting mesh (diagonal crosshatch with perspective)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  // Horizontal / angled ribs
  for (let y = GOAL_TOP; y <= GOAL_BOTTOM; y += 12) {
    const frac = (y - GOAL_TOP) / (GOAL_BOTTOM - GOAL_TOP);
    const backY = GOAL_TOP + 12 + frac * (GOAL_BOTTOM - GOAL_TOP - 24);
    ctx.moveTo(GOAL_X, y);
    ctx.lineTo(backX - rippleWave, backY);
  }

  // Vertical back ribs
  for (let x = backX; x <= GOAL_X; x += 8) {
    const frac = (x - backX) / netDepth;
    const topY = GOAL_TOP + 12 * (1 - frac);
    const botY = GOAL_BOTTOM - 12 * (1 - frac);
    ctx.moveTo(x - rippleWave * (1 - frac), topY);
    ctx.lineTo(x - rippleWave * (1 - frac), botY);
  }
  ctx.stroke();

  // Goal Frame (Pipes)
  ctx.strokeStyle = '#dc2626'; // Goal post red
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Back pipes
  ctx.beginPath();
  ctx.moveTo(GOAL_X, GOAL_TOP);
  ctx.lineTo(backX - rippleWave, GOAL_TOP + 12);
  ctx.lineTo(backX - rippleWave, GOAL_BOTTOM - 12);
  ctx.lineTo(GOAL_X, GOAL_BOTTOM);
  ctx.stroke();

  // Front goal posts and crossbar
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(GOAL_X, GOAL_TOP - 2);
  ctx.lineTo(GOAL_X, GOAL_BOTTOM + 2);
  ctx.stroke();

  // Post corner caps
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(GOAL_X, GOAL_TOP, 4, 0, Math.PI * 2);
  ctx.arc(GOAL_X, GOAL_BOTTOM, 4, 0, Math.PI * 2);
  ctx.fill();
}
