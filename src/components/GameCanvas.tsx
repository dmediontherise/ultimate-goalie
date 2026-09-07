import React, { useEffect, useRef } from 'react';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DIVE_COST,
  GLOVE_SNAG_COST,
  MAGNET_RADIUS,
  POKE_COST,
} from '../game/constants';
import {
  advanceAccumulator,
  createAccumulator,
  FIXED_DT,
  MAX_ACCUMULATED_TIME,
} from '../game/accumulator';
import { createSim, step, SimEvent, SimInput, SimState } from '../game/sim';
import { GoalieStance, HudData, RoundConfig, SaveType, StickPosition, Vector2 } from '../types';
import { drawIce, NetRippleState } from '../game/render/ice';
import { drawGoalie, SurfaceFlashState } from '../game/render/goalie';
import {
  createIceSpray,
  drawGoalLight,
  drawMagnetField,
  drawPuck,
  GoalLight,
  Particle,
  ScreenShake,
  updateAndDrawParticles,
} from '../game/render/effects';

export interface GameCanvasProps {
  roundConfig: RoundConfig;
  onRoundEnd: (success: boolean, saveType?: SaveType) => void;
  hatTrickActive: boolean;
  octopusActive: boolean;
  onHudUpdate?: (hud: HudData) => void;
}

interface RenderStateSnapshot {
  puckPos: Vector2;
  puckVel: Vector2;
  goaliePos: Vector2;
  shooterPos: Vector2;
  stanceLerp: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  roundConfig,
  onRoundEnd,
  hatTrickActive,
  octopusActive,
  onHudUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const frameCount = useRef<number>(0);

  const simRef = useRef<SimState>(createSim(roundConfig, Date.now()));
  const onRoundEndRef = useRef(onRoundEnd);
  const onHudUpdateRef = useRef(onHudUpdate);

  const keysPressed = useRef<Set<string>>(new Set());
  const stickPos = useRef<StickPosition>(StickPosition.STRAIGHT);
  const touchGoaliePos = useRef<Vector2 | null>(null);
  const isDragging = useRef<boolean>(false);

  // Graphics & Render state (Requirement 10: decoupled from SimState)
  const prevRenderState = useRef<RenderStateSnapshot>({
    puckPos: { ...simRef.current.puckPos },
    puckVel: { ...simRef.current.puckVel },
    goaliePos: { ...simRef.current.goaliePos },
    shooterPos: { ...simRef.current.shooterPos },
    stanceLerp: simRef.current.stanceLerp,
  });

  const debugHitboxes = useRef<boolean>(false);
  const particles = useRef<Particle[]>([]);
  const surfaceFlash = useRef<SurfaceFlashState | null>(null);
  const screenShake = useRef<ScreenShake>({ magnitude: 0, duration: 0, elapsed: 0 });
  const goalLight = useRef<GoalLight>({ active: false, timer: 0, duration: 1.5 });
  const netRipple = useRef<NetRippleState>({ amplitude: 0, timer: 1, duration: 0.8 });

  const hats = useRef<Vector2[]>([]);
  const octopusPos = useRef<Vector2 | null>(null);

  useEffect(() => {
    onRoundEndRef.current = onRoundEnd;
  }, [onRoundEnd]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
  }, [onHudUpdate]);

  useEffect(() => {
    if (hatTrickActive && hats.current.length === 0) {
      for (let i = 0; i < 30; i++) {
        hats.current.push({
          x: Math.random() * CANVAS_WIDTH,
          y: Math.random() * CANVAS_HEIGHT,
        });
      }
    } else if (!hatTrickActive) {
      hats.current = [];
    }
  }, [hatTrickActive]);

  useEffect(() => {
    if (octopusActive && !octopusPos.current) {
      octopusPos.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    } else if (!octopusActive) {
      octopusPos.current = null;
    }
  }, [octopusActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Requirement 1: Sized to devicePixelRatio
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(CANVAS_WIDTH * dpr);
    canvas.height = Math.round(CANVAS_HEIGHT * dpr);

    simRef.current = createSim(roundConfig, Date.now());
    prevRenderState.current = {
      puckPos: { ...simRef.current.puckPos },
      puckVel: { ...simRef.current.puckVel },
      goaliePos: { ...simRef.current.goaliePos },
      shooterPos: { ...simRef.current.shooterPos },
      stanceLerp: simRef.current.stanceLerp,
    };

    keysPressed.current.clear();
    stickPos.current = StickPosition.STRAIGHT;
    touchGoaliePos.current = null;
    isDragging.current = false;
    frameCount.current = 0;
    particles.current = [];
    surfaceFlash.current = null;
    screenShake.current = { magnitude: 0, duration: 0, elapsed: 0 };
    goalLight.current = { active: false, timer: 0, duration: 1.5 };
    netRipple.current = { amplitude: 0, timer: 1, duration: 0.8 };

    let lastTime = performance.now();
    const accumulator = createAccumulator();

    const drawHats = (c: CanvasRenderingContext2D) => {
      hats.current.forEach(hat => {
        hat.y += 2;
        if (hat.y > CANVAS_HEIGHT) {
          hat.y = -20;
          hat.x = Math.random() * CANVAS_WIDTH;
        }

        c.fillStyle = '#3B82F6';
        c.beginPath();
        c.arc(hat.x, hat.y, 15, Math.PI, 0);
        c.fill();

        c.fillStyle = '#60A5FA';
        c.beginPath();
        c.ellipse(hat.x, hat.y, 15, 8, 0, 0, Math.PI);
        c.fill();
      });
    };

    const drawOctopus = (c: CanvasRenderingContext2D) => {
      if (!octopusPos.current) return;
      const { x, y } = octopusPos.current;
      c.fillStyle = '#8B0000';
      c.beginPath();
      c.arc(x, y, 30, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const legX = x + Math.cos(angle) * 50;
        const legY = y + Math.sin(angle) * 50;
        c.lineWidth = 10;
        c.strokeStyle = '#8B0000';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(legX, legY);
        c.stroke();
      }
    };

    const drawShooter = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      shotTriggered: boolean,
      windup: boolean
    ) => {
      const stride = Math.sin(frameCount.current * 0.3) * 10;

      // Skates
      c.fillStyle = '#1f2937';
      c.fillRect(x - 5 + stride, y - 15, 15, 8);
      c.fillRect(x - 5 - stride, y + 10, 15, 8);

      // Jersey
      c.fillStyle = '#dc2626';
      c.beginPath();
      c.arc(x, y, 20, 0, Math.PI * 2);
      c.fill();

      // Helmet
      c.fillStyle = '#000000';
      c.beginPath();
      c.arc(x - 5, y, 9, 0, Math.PI * 2);
      c.fill();

      // Stick
      c.strokeStyle = '#475569';
      c.lineWidth = 4;
      c.beginPath();
      const shoulderX = x - 5;
      const shoulderY = y + 5;
      let stickX: number;
      let stickY: number;

      if (windup) {
        stickX = x + 30;
        stickY = y - 30;
      } else if (shotTriggered) {
        stickX = x - 30;
        stickY = y + 20;
      } else {
        stickX = x - 25 + Math.sin(frameCount.current * 0.8) * 5;
        stickY = y + Math.cos(frameCount.current * 0.8) * 5;
      }

      c.moveTo(shoulderX, shoulderY);
      c.lineTo(stickX, stickY);
      c.lineTo(stickX - 10, stickY + 5);
      c.stroke();
    };

    // Requirement 8: Impact feedback handler driven by simulation events
    const handleImpact = (ev: SimEvent, sim: SimState) => {
      const speed = Math.hypot(sim.puckVel.x, sim.puckVel.y);

      if (ev.success && ev.saveType && ev.saveType !== 'miss') {
        // Save impact: ice-spray particles + surface flash + screen shake
        particles.current = createIceSpray(sim.puckPos, 35);
        surfaceFlash.current = { kind: ev.saveType, timer: 0.35, duration: 0.35 };
        const shakeMag = Math.min(16, Math.max(3, (speed / 600) * 8));
        screenShake.current = { magnitude: shakeMag, duration: 0.22, elapsed: 0 };
      } else if (!ev.success) {
        // Goal impact: goal light siren + net ripple + heavier screen shake
        goalLight.current = { active: true, timer: 1.5, duration: 1.5 };
        const rippleAmp = Math.min(18, Math.max(6, (speed / 600) * 12));
        netRipple.current = { amplitude: rippleAmp, timer: 0, duration: 0.8 };
        const shakeMag = Math.min(24, Math.max(6, (speed / 600) * 12));
        screenShake.current = { magnitude: shakeMag, duration: 0.32, elapsed: 0 };
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        debugHitboxes.current = !debugHitboxes.current;
        return;
      }

      if (simRef.current.roundEnded) return;
      keysPressed.current.add(e.code);
      if (e.code === 'Digit1' || e.code === 'KeyZ') stickPos.current = StickPosition.UP;
      if (e.code === 'Digit2' || e.code === 'KeyX') stickPos.current = StickPosition.STRAIGHT;
      if (e.code === 'Digit3' || e.code === 'KeyC') stickPos.current = StickPosition.DOWN;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const updateGoalieFromTouch = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;

      const targetX = (touch.clientX - rect.left) * scaleX;
      const targetY = (touch.clientY - rect.top) * scaleY;

      touchGoaliePos.current = {
        x: Math.max(50, Math.min(140, targetX)),
        y: Math.max(50, Math.min(CANVAS_HEIGHT - 50, targetY)),
      };
    };

    const handleTouchTap = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = CANVAS_HEIGHT / rect.height;
      const targetY = (touch.clientY - rect.top) * scaleY;

      if (targetY > CANVAS_HEIGHT * 0.66) {
        stickPos.current = StickPosition.DOWN;
      } else if (targetY < CANVAS_HEIGHT * 0.33) {
        stickPos.current = StickPosition.UP;
      } else {
        stickPos.current = StickPosition.STRAIGHT;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isDragging.current = true;
      updateGoalieFromTouch(e.touches[0]);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current && !simRef.current.roundEnded) {
        updateGoalieFromTouch(e.touches[0]);
      }
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (isDragging.current && e.changedTouches.length > 0) {
        handleTouchTap(e.changedTouches[0]);
      }
      isDragging.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    const frame = (now: number) => {
      const frameDelta = (now - lastTime) / 1000;
      lastTime = now;
      const frameTime = Math.min(frameDelta, MAX_ACCUMULATED_TIME);

      let roundEndEvent: SimEvent | null = null;

      advanceAccumulator(accumulator, frameDelta, (dt) => {
        if (!simRef.current.roundEnded) {
          prevRenderState.current = {
            puckPos: { ...simRef.current.puckPos },
            puckVel: { ...simRef.current.puckVel },
            goaliePos: { ...simRef.current.goaliePos },
            shooterPos: { ...simRef.current.shooterPos },
            stanceLerp: simRef.current.stanceLerp,
          };

          const magnetHeld =
            keysPressed.current.has('KeyM') ||
            keysPressed.current.has('ShiftLeft') ||
            keysPressed.current.has('ShiftRight') ||
            keysPressed.current.has('Digit7');

          const input: SimInput =
            isDragging.current && touchGoaliePos.current
              ? {
                  goaliePos: touchGoaliePos.current,
                  stickPos: stickPos.current,
                  pokeCheck:
                    keysPressed.current.has('KeyE') ||
                    keysPressed.current.has('Digit4'),
                  dive:
                    keysPressed.current.has('KeyF') ||
                    keysPressed.current.has('Space') ||
                    keysPressed.current.has('Digit5'),
                  gloveSnag:
                    keysPressed.current.has('KeyQ') ||
                    keysPressed.current.has('KeyR') ||
                    keysPressed.current.has('Digit6'),
                  magnet: magnetHeld,
                }
              : {
                  up:
                    keysPressed.current.has('ArrowUp') ||
                    keysPressed.current.has('KeyW'),
                  down:
                    keysPressed.current.has('ArrowDown') ||
                    keysPressed.current.has('KeyS'),
                  left:
                    keysPressed.current.has('ArrowLeft') ||
                    keysPressed.current.has('KeyA'),
                  right:
                    keysPressed.current.has('ArrowRight') ||
                    keysPressed.current.has('KeyD'),
                  stickPos: stickPos.current,
                  pokeCheck:
                    keysPressed.current.has('KeyE') ||
                    keysPressed.current.has('Digit4'),
                  dive:
                    keysPressed.current.has('KeyF') ||
                    keysPressed.current.has('Space') ||
                    keysPressed.current.has('Digit5'),
                  gloveSnag:
                    keysPressed.current.has('KeyQ') ||
                    keysPressed.current.has('KeyR') ||
                    keysPressed.current.has('Digit6'),
                  magnet: magnetHeld,
                };

          const events = step(simRef.current, input, dt);
          const endEvent = events.find(ev => ev.type === 'round-end');
          if (endEvent) {
            roundEndEvent = endEvent;
            handleImpact(endEvent, simRef.current);
            return true;
          }
        }
      });

      // Requirement 2: Sub-step render interpolation fraction
      const alpha = Math.max(0, Math.min(1, accumulator.time / FIXED_DT));

      const renderPuckPos = simRef.current.roundEnded
        ? simRef.current.puckPos
        : {
            x:
              prevRenderState.current.puckPos.x +
              alpha * (simRef.current.puckPos.x - prevRenderState.current.puckPos.x),
            y:
              prevRenderState.current.puckPos.y +
              alpha * (simRef.current.puckPos.y - prevRenderState.current.puckPos.y),
          };

      const renderGoaliePos = {
        x:
          prevRenderState.current.goaliePos.x +
          alpha * (simRef.current.goaliePos.x - prevRenderState.current.goaliePos.x),
        y:
          prevRenderState.current.goaliePos.y +
          alpha * (simRef.current.goaliePos.y - prevRenderState.current.goaliePos.y),
      };

      const renderShooterPos = {
        x:
          prevRenderState.current.shooterPos.x +
          alpha * (simRef.current.shooterPos.x - prevRenderState.current.shooterPos.x),
        y:
          prevRenderState.current.shooterPos.y +
          alpha * (simRef.current.shooterPos.y - prevRenderState.current.shooterPos.y),
      };

      // Requirement 6: Continuous stance lerp from goalie.ts
      const renderStanceLerp =
        prevRenderState.current.stanceLerp +
        alpha * (simRef.current.stanceLerp - prevRenderState.current.stanceLerp);

      // Advance effect timers
      if (surfaceFlash.current && surfaceFlash.current.timer > 0) {
        surfaceFlash.current.timer -= frameTime;
      }
      if (goalLight.current.active && goalLight.current.timer > 0) {
        goalLight.current.timer -= frameTime;
      }
      if (netRipple.current.timer < netRipple.current.duration) {
        netRipple.current.timer += frameTime;
      }
      if (screenShake.current.duration > 0 && screenShake.current.elapsed < screenShake.current.duration) {
        screenShake.current.elapsed += frameTime;
      }

      frameCount.current++;

      // Requirement 1: DPR Scaling & Screen Shake
      ctx.save();
      ctx.scale(dpr, dpr);

      // Screen shake transform
      if (screenShake.current.duration > 0 && screenShake.current.elapsed < screenShake.current.duration) {
        const decay = 1 - screenShake.current.elapsed / screenShake.current.duration;
        const shakeX = Math.sin(frameCount.current * 1.6) * screenShake.current.magnitude * decay;
        const shakeY = Math.cos(frameCount.current * 1.4) * screenShake.current.magnitude * decay;
        ctx.translate(shakeX, shakeY);
      }

      // 1. Rebuilt Ice Surface, Boards, Crease, and 3D Net
      drawIce(ctx, netRipple.current);

      // 2. Decorative Hats & Octopus
      drawHats(ctx);
      drawOctopus(ctx);

      // 3. Magnet Cone Field (Requirement 9)
      if (
        simRef.current.config.hasMagnet &&
        simRef.current.magnet &&
        simRef.current.magnet.active &&
        simRef.current.magnet.charge > 0
      ) {
        drawMagnetField(
          ctx,
          renderGoaliePos,
          simRef.current.magnet.charge,
          frameCount.current
        );
      }

      // 4. Shooter
      drawShooter(
        ctx,
        renderShooterPos.x,
        renderShooterPos.y,
        simRef.current.hasShot,
        simRef.current.windUpStart !== null
      );

      // 5. Goalie drawn FROM getHitboxes (Requirement 3, 4, 6)
      drawGoalie(
        ctx,
        simRef.current.goalie,
        renderGoaliePos,
        renderStanceLerp,
        surfaceFlash.current,
        debugHitboxes.current,
        frameCount.current
      );

      // 6. Puck with dynamic velocity motion streak (Requirement 7)
      drawPuck(ctx, renderPuckPos, simRef.current.puckVel, frameTime);

      // 7. Ice-spray particles (Requirement 8)
      particles.current = updateAndDrawParticles(ctx, particles.current, frameTime);

      // 8. Goal Siren Light on net (Requirement 8)
      drawGoalLight(ctx, goalLight.current, frameCount.current);

      // 9. Debug HUD Badge if active
      if (debugHitboxes.current) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(CANVAS_WIDTH - 220, CANVAS_HEIGHT - 35, 210, 25);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(CANVAS_WIDTH - 220, CANVAS_HEIGHT - 35, 210, 25);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('HITBOX DEBUG ON (Press H)', CANVAS_WIDTH - 210, CANVAS_HEIGHT - 18);
      }

      // 10. Requirement 7: Report live HUD values every frame
      if (onHudUpdateRef.current) {
        const goalie = simRef.current.goalie;
        const magnet = simRef.current.magnet;
        const hasMagnet = !!simRef.current.config.hasMagnet;
        const canStartMove = goalie.activeTimer === 0 && goalie.recoveryTimer === 0;

        onHudUpdateRef.current({
          stamina: goalie.stamina,
          magnetCharge: magnet ? magnet.charge : 0,
          hasMagnet,
          magnetActive: hasMagnet && !!magnet?.active,
          stance: goalie.stance,
          activeTimer: goalie.activeTimer,
          recoveryTimer: goalie.recoveryTimer,
          canPoke: canStartMove && goalie.stamina >= POKE_COST,
          canDive: canStartMove && goalie.stamina >= DIVE_COST,
          canGloveSnag: canStartMove && goalie.stamina >= GLOVE_SNAG_COST,
          pokeCost: POKE_COST,
          diveCost: DIVE_COST,
          gloveCost: GLOVE_SNAG_COST,
          pokeCooldown:
            goalie.activeTimer > 0 && goalie.stance === GoalieStance.POKE_CHECK
              ? goalie.activeTimer
              : goalie.recoveryTimer,
          diveCooldown:
            goalie.activeTimer > 0 && goalie.stance === GoalieStance.DESPERATION_DIVE
              ? goalie.activeTimer
              : goalie.recoveryTimer,
          gloveCooldown:
            goalie.activeTimer > 0 && goalie.stance === GoalieStance.GLOVE_SNAG
              ? goalie.activeTimer
              : goalie.recoveryTimer,
        });
      }

      ctx.restore();

      const endEvent = roundEndEvent as SimEvent | null;
      if (endEvent) {
        onRoundEndRef.current(endEvent.success, endEvent.saveType);
        return;
      }

      animationFrameId.current = requestAnimationFrame(frame);
    };

    animationFrameId.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [roundConfig]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain rounded-lg shadow-2xl border-4 border-slate-700 bg-slate-100 cursor-none"
    />
  );
};

export default React.memo(GameCanvas);

