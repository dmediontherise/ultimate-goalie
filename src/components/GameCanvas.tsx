import React, { useEffect, useRef } from 'react';
import { StickPosition, Vector2, RoundConfig, SaveType } from '../types';

interface GameCanvasProps {
  roundConfig: RoundConfig;
  onRoundEnd: (success: boolean, saveType?: SaveType) => void;
  hatTrickActive: boolean;
  octopusActive: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ roundConfig, onRoundEnd, hatTrickActive, octopusActive }) => {
  console.log('GameCanvas: Rendering component.');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const frameCount = useRef<number>(0);
  
  // Game State Refs (Mutable for performance loop)
  const goaliePos = useRef<Vector2>({ x: 100, y: 300 });
  const stickPos = useRef<StickPosition>(StickPosition.STRAIGHT);
  const stanceLerp = useRef<number>(0); // 0.0 (Standing) to 1.0 (Butterfly)
  
  const shooterPos = useRef<Vector2>({ x: 700, y: 300 });
  const puckPos = useRef<Vector2>({ x: 700, y: 300 });
  const puckVel = useRef<Vector2>({ x: 0, y: 0 });
  
  const puckTrail = useRef<Vector2[]>([]);
  const hats = useRef<Vector2[]>([]);
  const octopusPos = useRef<Vector2 | null>(null);
  const hasShot = useRef<boolean>(false);
  const roundEnded = useRef<boolean>(false);
  const keysPressed = useRef<Set<string>>(new Set());
  const windUpStart = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  // Constants
  const GOALIE_RADIUS = 20;
  const PUCK_RADIUS = 6;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const GOAL_TOP = 170;
  const GOAL_BOTTOM = 430;
  const GOAL_X = 40; 
  
  // Reset state on new round
  useEffect(() => {
    console.log('GameCanvas: useEffect - New round config. Resetting state.', roundConfig);
    goaliePos.current = { x: 100, y: CANVAS_HEIGHT / 2 };
    shooterPos.current = { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT / 2 };
    puckPos.current = { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT / 2 };
    puckVel.current = { x: 0, y: 0 };
    hasShot.current = false;
    roundEnded.current = false;
    windUpStart.current = null;
    stickPos.current = StickPosition.STRAIGHT;
    stanceLerp.current = 0;
    frameCount.current = 0;
    isDragging.current = false;
    keysPressed.current.clear();
    puckTrail.current = [];
  }, [roundConfig]);

  useEffect(() => {
    console.log('GameCanvas: useEffect - hatTrickActive changed to', hatTrickActive);
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
    console.log('GameCanvas: useEffect - octopusActive changed to', octopusActive);
    if (octopusActive && !octopusPos.current) {
      octopusPos.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    } else if (!octopusActive) {
      octopusPos.current = null;
    }
  }, [octopusActive]);

  useEffect(() => {
    console.log('GameCanvas: useEffect - Main effect running. Setting up canvas and game loop.');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('GameCanvas: useEffect - Canvas ref is null. Skipping setup.');
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('GameCanvas: useEffect - Could not get 2D context. Skipping setup.');
      return;
    }
    
    // --- Drawing ---
    const drawHats = (ctx: CanvasRenderingContext2D) => {
      hats.current.forEach(hat => {
        hat.y += 2; // Rain fall animation
        if (hat.y > CANVAS_HEIGHT) {
          hat.y = -20;
          hat.x = Math.random() * CANVAS_WIDTH;
        }

        ctx.fillStyle = '#3B82F6'; // Blue cap
        ctx.beginPath();
        ctx.arc(hat.x, hat.y, 15, 0, Math.PI, true);
        ctx.fill();
        
        ctx.fillStyle = '#60A5FA'; // Lighter blue brim
        ctx.beginPath();
        ctx.ellipse(hat.x, hat.y, 15, 5, 0, 0, Math.PI);
        ctx.fill();
      });
    };

    const drawOctopus = (ctx: CanvasRenderingContext2D) => {
      if (!octopusPos.current) return;
      console.log('GameCanvas: drawOctopus - Drawing octopus at', octopusPos.current);
      const { x, y } = octopusPos.current;
      ctx.fillStyle = '#8B0000';
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const legX = x + Math.cos(angle) * 50;
        const legY = y + Math.sin(angle) * 50;
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(legX, legY);
        ctx.stroke();
      }
    };

    // --- Input Handling ---

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('GameCanvas: handleKeyDown - Key pressed:', e.code);
      if (roundEnded.current) return; 
      keysPressed.current.add(e.code);
      if (e.code === 'Digit1' || e.code === 'KeyZ') stickPos.current = StickPosition.UP;
      if (e.code === 'Digit2' || e.code === 'KeyX') stickPos.current = StickPosition.STRAIGHT;
      if (e.code === 'Digit3' || e.code === 'KeyC') stickPos.current = StickPosition.DOWN;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      console.log('GameCanvas: handleKeyUp - Key released:', e.code);
      keysPressed.current.delete(e.code);
    };

    // Touch Drag Logic
    const handleTouchStart = (e: TouchEvent) => {
      console.log('GameCanvas: handleTouchStart - Touch started.');
      e.preventDefault();
      isDragging.current = true;
      updateGoalieFromTouch(e.touches[0]);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current && !roundEnded.current) {
        console.log('GameCanvas: handleTouchMove - Touch moved.');
        updateGoalieFromTouch(e.touches[0]);
      }
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      console.log('GameCanvas: handleTouchEnd - Touch ended.');
      e.preventDefault();
      isDragging.current = false;
    };

    const updateGoalieFromTouch = (touch: Touch) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Map screen coordinates to canvas 800x600 coordinates
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      const targetX = (touch.clientX - rect.left) * scaleX;
      const targetY = (touch.clientY - rect.top) * scaleY;

      if (targetY > CANVAS_HEIGHT * 0.66) {
        stickPos.current = StickPosition.DOWN;
      } else if (targetY < CANVAS_HEIGHT * 0.33) {
        stickPos.current = StickPosition.UP;
      } else {
        stickPos.current = StickPosition.STRAIGHT;
      }

      // Apply constraints immediately
      goaliePos.current.x = Math.max(50, Math.min(140, targetX));
      goaliePos.current.y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, targetY));
      console.log('GameCanvas: updateGoalieFromTouch - Goalie pos:', goaliePos.current, 'Stick pos:', stickPos.current);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // --- Game Loop ---

    const update = () => {
      if (roundEnded.current) return;
      // console.log('GameCanvas: update - Game loop running. Frame:', frameCount.current); // Too chatty
      frameCount.current++;

      // 1. Update Animation State (Fluid Transition)
      const targetStance = stickPos.current === StickPosition.DOWN ? 1.0 : 0.0;
      stanceLerp.current += (targetStance - stanceLerp.current) * 0.15;

      // 2. Goalie Movement (Keys)
      if (!isDragging.current) {
        const baseSpeed = 4;
        const speed = roundConfig.hasPowerUp ? baseSpeed * 2 : baseSpeed;

        if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('KeyW')) goaliePos.current.y -= speed;
        if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('KeyS')) goaliePos.current.y += speed;
        if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('KeyA')) goaliePos.current.x -= speed;
        if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('KeyD')) goaliePos.current.x += speed;

        goaliePos.current.x = Math.max(50, Math.min(140, goaliePos.current.x));
        goaliePos.current.y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, goaliePos.current.y));
      }

      // 3. Shooter AI
      if (!hasShot.current) {
        const isSlapShot = roundConfig.isSlapShot;
        
        if (!windUpStart.current) {
            shooterPos.current.x -= roundConfig.shooterSpeed;
            const time = Date.now() / 200;
            shooterPos.current.y += Math.sin(time) * roundConfig.shooterSpeed * 0.5 + (Math.random() - 0.5) * roundConfig.jitter * 2;
            shooterPos.current.y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, shooterPos.current.y));
        }

        puckPos.current = { ...shooterPos.current };
        puckPos.current.x -= 20; 

        const shootThreshold = 250 + Math.random() * 100; 
        
        if (shooterPos.current.x < shootThreshold) {
            if (isSlapShot && !windUpStart.current) {
                windUpStart.current = Date.now();
                console.log('GameCanvas: update - Shooter windup started.');
            } else if (isSlapShot && windUpStart.current) {
                if (Date.now() - windUpStart.current > 500) takeShot();
            } else {
                takeShot();
            }
        }
      } else {
        // Puck Physics
        if (roundConfig.hasMagnet) {
          const dx = goaliePos.current.x - puckPos.current.x;
          const dy = goaliePos.current.y - puckPos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          if (dist < 100 && (angle > -Math.PI * 0.75 && angle < Math.PI * 0.75)) {
            puckVel.current.x += dx / dist * 2;
            puckVel.current.y += dy / dist * 2;
          }
        }

        puckPos.current.x += puckVel.current.x;
        puckPos.current.y += puckVel.current.y;
        if (roundConfig.curveFactor !== 0) {
            puckVel.current.y += (Math.random() - 0.5) * roundConfig.curveFactor * 0.4;
        }
        
        puckTrail.current.push({ ...puckPos.current });
        if (puckTrail.current.length > 15) {
            puckTrail.current.shift();
        }
      }

      // 4. Collision Detection
      const dx = puckPos.current.x - goaliePos.current.x;
      const dy = puckPos.current.y - goaliePos.current.y;
      if (Math.sqrt(dx*dx + dy*dy) < GOALIE_RADIUS + PUCK_RADIUS) {
        console.log('GameCanvas: update - Collision detected (body).');
        endRound(true, 'body');
        return;
      }

      let stickYOffset = 0;
      if (stickPos.current === StickPosition.UP) stickYOffset = -35;
      if (stickPos.current === StickPosition.DOWN) stickYOffset = 35;
      
      const stickX = goaliePos.current.x + 20;
      const stickY = goaliePos.current.y + stickYOffset;
      const stickRadius = 18; 
      
      const sdx = puckPos.current.x - stickX;
      const sdy = puckPos.current.y - stickY;
      if (Math.sqrt(sdx*sdx + sdy*sdy) < stickRadius + PUCK_RADIUS) {
          console.log('GameCanvas: update - Collision detected (stick).');
          endRound(true, 'stick'); 
          return;
      }

      if (stickPos.current === StickPosition.UP) {
        if (puckPos.current.x > goaliePos.current.x - 35 && 
            puckPos.current.x < goaliePos.current.x + 35 &&
            puckPos.current.y > goaliePos.current.y - 70 && 
            puckPos.current.y < goaliePos.current.y - 15) {
            console.log('GameCanvas: update - Collision detected (glove).');
            endRound(true, 'glove');
            return;
        }
      }

      if (stickPos.current === StickPosition.DOWN) {
        if (puckPos.current.x > goaliePos.current.x - 60 && 
            puckPos.current.x < goaliePos.current.x + 60 &&
            puckPos.current.y > goaliePos.current.y + 10 && 
            puckPos.current.y < goaliePos.current.y + 50) {
            console.log('GameCanvas: update - Collision detected (butterfly).');
            endRound(true, 'butterfly');
            return;
        }
      }

      if (puckPos.current.x < GOAL_X + 5) {
        if (puckPos.current.y > GOAL_TOP && puckPos.current.y < GOAL_BOTTOM) {
          console.log('GameCanvas: update - Goal scored.');
          endRound(false);
        } else {
            console.log('GameCanvas: update - Puck missed goal (out of bounds).');
            endRound(true, 'miss');
        }
      }
      
      if (puckPos.current.x < 0 || puckPos.current.y < 0 || puckPos.current.y > CANVAS_HEIGHT) {
          console.log('GameCanvas: update - Puck out of bounds (canvas edge).');
          endRound(true, 'miss');
      }

      draw(ctx);
      animationFrameId.current = requestAnimationFrame(update);
    };

    const takeShot = () => {
        hasShot.current = true;
        console.log('GameCanvas: takeShot - AI taking shot.');
        const goalCenter = (GOAL_TOP + GOAL_BOTTOM) / 2;
        let finalTargetY = goalCenter;
        if (roundConfig.aiIntelligence > 0.5) {
            const corner = Math.random() > 0.5 ? GOAL_TOP + 15 : GOAL_BOTTOM - 15;
            finalTargetY = goalCenter + (corner - goalCenter) * roundConfig.aiIntelligence;
        } else {
           finalTargetY = goalCenter + (Math.random() * 100 - 50);
        }

        const targetX = GOAL_X;
        const dx = targetX - puckPos.current.x;
        const dy = finalTargetY - puckPos.current.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        puckVel.current = {
          x: (dx / dist) * roundConfig.shotSpeed,
          y: (dy / dist) * roundConfig.shotSpeed
        };
        console.log('GameCanvas: takeShot - Puck velocity set to:', puckVel.current);
    }

    const endRound = (success: boolean, saveType?: SaveType) => {
      console.log('GameCanvas: endRound - Round ended. Success:', success, 'SaveType:', saveType);
      roundEnded.current = true;
      onRoundEnd(success, saveType);
    };

    // --- Drawing ---
    const drawGoalie = (ctx: CanvasRenderingContext2D, x: number, y: number, stick: StickPosition) => {
        const t = stanceLerp.current;
        const breath = Math.sin(frameCount.current * 0.1) * 1.5;
        
        const bodyYOffset = t * 15; 
        const bodyY = y + bodyYOffset;
        const headY = bodyY - 25;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 45, 30 + (t * 15), 10, 0, 0, Math.PI*2);
        ctx.fill();

        // Pads
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        
        ctx.save();
        ctx.translate(x - 15 - (t * 10), y + 5 + (t * 20)); 
        ctx.rotate(t * 1.4); 
        ctx.fillRect(-8, -20, 16, 55);
        ctx.strokeRect(-8, -20, 16, 55);
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(x + 15 + (t * 10), y + 5 + (t * 20));
        ctx.rotate(t * -1.4);
        ctx.fillRect(-8, -20, 16, 55);
        ctx.strokeRect(-8, -20, 16, 55);
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.restore();

        // Jersey
        ctx.fillStyle = '#1e3a8a'; // Dark blue
        ctx.beginPath();
        if (t > 0.5) { // Butterfly
             ctx.ellipse(x, y + 15, 22, 18, 0, 0, Math.PI*2);
        } else { // Standing
             ctx.fillRect(x - 20, y - 10 + breath, 40, 25);
        }
        ctx.fill();

        // Chest Protector
        ctx.fillStyle = '#2563eb'; // Lighter blue
        ctx.beginPath();
        ctx.arc(x, bodyY - 10 + breath, 24, 0, Math.PI*2);
        ctx.fill();
        
        // Shoulders
        ctx.beginPath();
        ctx.arc(x - 20, bodyY - 15 + breath, 12, 0, Math.PI*2);
        ctx.arc(x + 20, bodyY - 15 + breath, 12, 0, Math.PI*2);
        ctx.fill();

        // Logo
        ctx.fillStyle = '#facc15'; // Yellow
        ctx.beginPath(); ctx.arc(x, bodyY - 10 + breath, 8, 0, Math.PI*2); ctx.fill();

        // Helmet
        ctx.fillStyle = '#f1f5f9'; // White
        ctx.beginPath(); ctx.arc(x, headY + breath, 14, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
        // Cage
        ctx.beginPath();
        ctx.moveTo(x - 8, headY + breath - 5); ctx.lineTo(x + 8, headY + breath - 5);
        ctx.moveTo(x, headY + breath - 10); ctx.lineTo(x, headY + breath + 10);
        ctx.stroke();
        
        const baseGloveY = bodyY;
        const baseBlockerY = bodyY + 5;
        
        let targetGloveY = baseGloveY;
        let targetBlockerY = baseBlockerY;

        if (stick === StickPosition.UP) {
            targetGloveY = headY - 10;
            targetBlockerY = headY - 5;
        } else if (stick === StickPosition.DOWN) {
            targetGloveY = bodyY + 15;
            targetBlockerY = bodyY + 20;
        }
        
        const gloveX = x - 35; 
        const blockerX = x + 35;
        
        // Arms
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        
        ctx.beginPath(); ctx.moveTo(x - 20, bodyY - 15 + breath); 
        ctx.quadraticCurveTo(x - 35, bodyY + breath, gloveX, targetGloveY + breath); ctx.stroke();

        // Glove
        ctx.fillStyle = '#b91c1c'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2;
        ctx.beginPath();
        const gloveAngle = stick === StickPosition.UP ? -0.5 : 0.2;
        ctx.ellipse(gloveX, targetGloveY + breath, 14, 16, gloveAngle, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gloveX, targetGloveY + breath, 6, 0, Math.PI*2); ctx.fill();

        // Arm
        ctx.beginPath(); ctx.moveTo(x + 20, bodyY - 15 + breath);
        ctx.quadraticCurveTo(x + 35, bodyY + breath, blockerX, targetBlockerY + breath); ctx.stroke();

        // Blocker
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(blockerX - 12, targetBlockerY + breath - 10, 24, 20);
        ctx.strokeRect(blockerX - 12, targetBlockerY + breath - 10, 24, 20);

        // Stick
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(blockerX - 5, targetBlockerY + breath - 20);
        ctx.lineTo(blockerX + 5, targetBlockerY + breath + 10);
        
        if (stick === StickPosition.DOWN) {
            ctx.lineTo(x + 10, y + 45); 
            ctx.lineTo(x + 60, y + 45); 
        } else if (stick === StickPosition.UP) {
            ctx.lineTo(blockerX + 10, y + 40); 
            ctx.lineTo(blockerX + 30, y + 30);
        } else {
            ctx.lineTo(blockerX + 15, y + 45);
            ctx.lineTo(blockerX + 45, y + 35);
        }
        ctx.stroke();
    };

    const drawShooter = (ctx: CanvasRenderingContext2D, x: number, y: number, shotTriggered: boolean, windup: boolean) => {
        const stride = Math.sin(frameCount.current * 0.3) * 10;

        // Skates
        ctx.fillStyle = '#1f2937'; // Dark gray
        ctx.fillRect(x - 5 + stride, y - 15, 15, 8); 
        ctx.fillRect(x - 5 - stride, y + 10, 15, 8); 

        // Jersey
        ctx.fillStyle = '#dc2626'; // Red
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
        
        // Helmet
        ctx.fillStyle = '#000000'; // Black
        ctx.beginPath(); ctx.arc(x - 5, y, 9, 0, Math.PI * 2); ctx.fill();

        // Stick
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
        ctx.beginPath();
        const shoulderX = x - 5; const shoulderY = y + 5;
        let stickX, stickY;

        if (windup) {
            stickX = x + 30; stickY = y - 30;
        } else if (shotTriggered) {
            stickX = x - 30; stickY = y + 20;
        } else {
            stickX = x - 25 + Math.sin(frameCount.current * 0.8) * 5;
            stickY = y + Math.cos(frameCount.current * 0.8) * 5;
        }

        ctx.moveTo(shoulderX, shoulderY); ctx.lineTo(stickX, stickY); ctx.lineTo(stickX - 10, stickY + 5); ctx.stroke();
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      console.log('GameCanvas: draw - Drawing frame.');
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawHats(ctx);
      drawOctopus(ctx);
      
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(GOAL_X, 0); ctx.lineTo(GOAL_X, CANVAS_HEIGHT); ctx.stroke();

      ctx.fillStyle = '#bfdbfe'; ctx.strokeStyle = '#ef4444'; ctx.beginPath(); ctx.arc(GOAL_X, CANVAS_HEIGHT/2, 60, -Math.PI/2, Math.PI/2); ctx.fill(); ctx.stroke();
      
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 5; ctx.strokeRect(GOAL_X - 30, GOAL_TOP, 30, GOAL_BOTTOM - GOAL_TOP);
      ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = '#cbd5e1';
      for(let i=GOAL_TOP; i<GOAL_BOTTOM; i+=10) { ctx.moveTo(GOAL_X-30, i); ctx.lineTo(GOAL_X, i); }
      for(let i=GOAL_X-30; i<GOAL_X; i+=10) { ctx.moveTo(i, GOAL_TOP); ctx.lineTo(i, GOAL_BOTTOM); }
      ctx.stroke();

      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH + 100, 150, 200, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH + 100, CANVAS_HEIGHT - 150, 200, 0, Math.PI*2); ctx.stroke();

      drawShooter(ctx, shooterPos.current.x, shooterPos.current.y, hasShot.current, !!windUpStart.current);
      
      drawGoalie(ctx, goaliePos.current.x, goaliePos.current.y, stickPos.current);

      puckTrail.current.forEach((p, index) => {
        const opacity = (index / puckTrail.current.length) * 0.5;
        const radius = (index / puckTrail.current.length) * PUCK_RADIUS;
        ctx.fillStyle = `rgba(15, 23, 42, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(puckPos.current.x, puckPos.current.y, PUCK_RADIUS, 0, Math.PI * 2); ctx.fill();
    };

    update();

    return () => {
      console.log('GameCanvas: useEffect - Cleanup. Removing event listeners and canceling animation frame.');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [roundConfig, onRoundEnd]);

  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={600} 
      className="w-full h-full object-contain rounded-lg shadow-2xl border-4 border-slate-700 bg-slate-100 cursor-none"
    />
  );
};

export default GameCanvas;