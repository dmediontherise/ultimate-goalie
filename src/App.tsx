import React, { useState, useMemo, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, GoalieStance, HudData, RoundConfig, StickPosition, SaveType } from './types';
import { getRoundConfig } from './game/rounds';
import { DIVE_COST, GLOVE_SNAG_COST, POKE_COST } from './game/constants';
import { getCommentary } from './services/geminiService';


// Helper for simulating keys
const simulateKey = (code: string, type: 'keydown' | 'keyup') => {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
};

// TouchButton Component moved outside to prevent re-creation on render
const TouchButton: React.FC<{ code: string, label: string, color?: string, sub?: string }> = ({ code, label, color = "bg-slate-700", sub }) => {
  // Cleanup: Ensure keyup is fired if component unmounts while pressed
  useEffect(() => {
    return () => {
      simulateKey(code, 'keyup');
    };
  }, [code]);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); // Prevent ghost clicks
    simulateKey(code, 'keydown');
  };

  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    simulateKey(code, 'keyup');
  };

  return (
    <button
      className={`${color} w-full h-16 rounded-xl shadow-lg active:scale-95 transition-transform flex flex-col items-center justify-center select-none touch-none`}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="font-bold text-xl text-white">{label}</span>
      {sub && <span className="text-[10px] text-slate-300 uppercase">{sub}</span>}
    </button>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentRound, setCurrentRound] = useState(1);
  const [score, setScore] = useState(0);
  const [consecutiveAIScores, setConsecutiveAIScores] = useState(0);
  const [hatTrickActive, setHatTrickActive] = useState(false);
  const [consecutiveSaves, setConsecutiveSaves] = useState(0);
  const [octopusActive, setOctopusActive] = useState(false);
  const [magnetActive, setMagnetActive] = useState(false);
  const [commentary, setCommentary] = useState<string>("");
  const [loadingCommentary, setLoadingCommentary] = useState(false);

  const roundConfig: RoundConfig = useMemo(() => getRoundConfig(currentRound), [currentRound]);

  const [hudData, setHudData] = useState<HudData>(() => ({
    stamina: 1,
    magnetCharge: 1,
    hasMagnet: false,
    magnetActive: false,
    stance: GoalieStance.STAND,
    activeTimer: 0,
    recoveryTimer: 0,
    canPoke: true,
    canDive: true,
    canGloveSnag: true,
    pokeCost: POKE_COST,
    diveCost: DIVE_COST,
    gloveCost: GLOVE_SNAG_COST,
    pokeCooldown: 0,
    diveCooldown: 0,
    gloveCooldown: 0,
  }));

  const handleHudUpdate = useCallback((hud: HudData) => {
    setHudData(hud);
  }, []);
  
  // Effect for round transition
  const nextRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
    setGameState(GameState.PLAYING);
  }, []);

  useEffect(() => {
    if (gameState === GameState.ROUND_TRANSITION) {
      const timer = setTimeout(() => {
        nextRound();
      }, 500); // Duration of the wipe animation
      return () => clearTimeout(timer);
    }
  }, [gameState, nextRound]);


  const startGame = () => {
    setScore(0);
    setCurrentRound(1);
    setGameState(GameState.PLAYING);
    setConsecutiveAIScores(0);
    setHatTrickActive(false);
    setConsecutiveSaves(0);
    setOctopusActive(false);
    setMagnetActive(false);
  };


  const handleRoundEnd = useCallback(async (success: boolean, saveType?: SaveType) => {
    if (success) {
      if (consecutiveSaves === 5) {
        setOctopusActive(true);
      }
      setConsecutiveSaves(prev => prev + 1);
      setScore(prev => prev + 1);
      setConsecutiveAIScores(0);
      setGameState(GameState.ROUND_WON);
    } else {
      if (consecutiveAIScores === 2) {
        setHatTrickActive(true);
      }
      setConsecutiveSaves(0);
      setConsecutiveAIScores(prev => prev + 1);
      setGameState(GameState.ROUND_LOST);
    }

    // Fetch AI Commentary
    setLoadingCommentary(true);
    
    let shotType = "";
    if (roundConfig.isSlapShot) shotType = "Slap Shot";
    if (roundConfig.hasPowerUp) shotType = "Power Shot";
    if (currentRound === 7) shotType = "Curveball";

    const text = await getCommentary(currentRound, success, shotType, saveType);
    setCommentary(text);
    setLoadingCommentary(false);
  }, [roundConfig, consecutiveSaves, consecutiveAIScores]);

  const proceedToNextOrEnd = useCallback(() => {
    if (currentRound >= 10) {
      setGameState(GameState.GAME_OVER);
    } else {
      setGameState(GameState.ROUND_TRANSITION);
    }
  }, [currentRound]);

  const resetGame = useCallback(() => {
    setGameState(GameState.MENU);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-900 font-sans relative overflow-y-auto pb-8">
      
      {/* Header */}
      <div className="py-4 text-center shrink-0">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-500 tracking-widest uppercase drop-shadow-lg">Ultimate Goalie v3</h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1">Defend the net against the AI machine</p>
      </div>

      {/* Game Container */}
      <div className="w-full max-w-[800px] aspect-[4/3] relative shrink-0 shadow-2xl rounded-lg overflow-hidden bg-slate-800 mx-auto">
        
        {/* HUD */}
        {gameState !== GameState.MENU && gameState !== GameState.GAME_OVER && (
          <div className="absolute top-2.5 left-3 right-3 z-10 pointer-events-none select-none flex flex-col gap-1.5">
            {/* Top row: Round, Resource Bars, Saves */}
            <div className="flex items-center justify-between gap-2">
              {/* Round Badge */}
              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 px-3 py-1.5 rounded-lg shadow-md font-mono font-bold text-xs md:text-sm text-white shrink-0">
                Round: <span className="text-blue-400">{currentRound}</span>/10
              </div>

              {/* Resource Bars: Stamina and Magnet */}
              <div className="flex-1 max-w-sm md:max-w-md flex flex-col gap-1 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 p-1.5 md:p-2 rounded-lg shadow-md">
                {/* Stamina Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] md:text-xs font-bold text-slate-300 w-14 md:w-16 tracking-wider">STAMINA</span>
                  <div className="flex-1 h-2.5 md:h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hudData.stamina > 0.5
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : hudData.stamina > 0.25
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
                          : 'bg-gradient-to-r from-red-600 to-rose-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, hudData.stamina * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-semibold text-slate-300 w-9 text-right">
                    {Math.round(hudData.stamina * 100)}%
                  </span>
                </div>

                {/* Magnet Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] md:text-xs font-bold text-slate-300 w-14 md:w-16 tracking-wider">MAGNET</span>
                  <div className="flex-1 h-2.5 md:h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    {roundConfig.hasMagnet ? (
                      <div
                        className={`h-full transition-all duration-75 ${
                          hudData.magnetActive
                            ? 'bg-gradient-to-r from-cyan-400 to-indigo-400 animate-pulse'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, hudData.magnetCharge * 100))}%` }}
                      />
                    ) : (
                      <div className="h-full bg-slate-700/40 w-full flex items-center justify-center">
                        <span className="text-[8px] md:text-[9px] text-slate-500 font-medium tracking-wide">LOCKED (R5–10)</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-semibold text-slate-300 w-9 text-right">
                    {roundConfig.hasMagnet ? `${Math.round(hudData.magnetCharge * 100)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Saves Badge */}
              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 px-3 py-1.5 rounded-lg shadow-md font-mono font-bold text-xs md:text-sm text-white shrink-0">
                Saves: <span className="text-emerald-400">{score}</span>
              </div>
            </div>

            {/* Bottom row: Ability Cooldown Badges */}
            <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs font-mono">
              {/* Poke Check */}
              <div className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border flex items-center gap-1.5 shadow-sm transition-colors ${
                hudData.stance === GoalieStance.POKE_CHECK && hudData.activeTimer > 0
                  ? 'bg-cyan-900/80 border-cyan-400 text-cyan-200 animate-pulse'
                  : hudData.pokeCooldown > 0
                  ? 'bg-slate-800/80 border-slate-600 text-slate-400'
                  : hudData.stamina < hudData.pokeCost
                  ? 'bg-slate-900/80 border-amber-800/60 text-amber-400'
                  : 'bg-slate-900/80 border-cyan-600/70 text-cyan-300'
              }`}>
                <span className="font-bold">POKE (E)</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-black/40">
                  {hudData.stance === GoalieStance.POKE_CHECK && hudData.activeTimer > 0
                    ? 'ACTIVE'
                    : hudData.pokeCooldown > 0
                    ? `${hudData.pokeCooldown.toFixed(1)}s`
                    : hudData.stamina < hudData.pokeCost
                    ? 'LOW NRG'
                    : 'READY'}
                </span>
              </div>

              {/* Desperation Dive */}
              <div className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border flex items-center gap-1.5 shadow-sm transition-colors ${
                hudData.stance === GoalieStance.DESPERATION_DIVE && hudData.activeTimer > 0
                  ? 'bg-amber-900/80 border-amber-400 text-amber-200 animate-pulse'
                  : hudData.diveCooldown > 0
                  ? 'bg-slate-800/80 border-slate-600 text-slate-400'
                  : hudData.stamina < hudData.diveCost
                  ? 'bg-slate-900/80 border-amber-800/60 text-amber-400'
                  : 'bg-slate-900/80 border-amber-600/70 text-amber-300'
              }`}>
                <span className="font-bold">DIVE (F)</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-black/40">
                  {hudData.stance === GoalieStance.DESPERATION_DIVE && hudData.activeTimer > 0
                    ? 'ACTIVE'
                    : hudData.diveCooldown > 0
                    ? `${hudData.diveCooldown.toFixed(1)}s`
                    : hudData.stamina < hudData.diveCost
                    ? 'LOW NRG'
                    : 'READY'}
                </span>
              </div>

              {/* Glove Snag */}
              <div className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border flex items-center gap-1.5 shadow-sm transition-colors ${
                hudData.stance === GoalieStance.GLOVE_SNAG && hudData.activeTimer > 0
                  ? 'bg-emerald-900/80 border-emerald-400 text-emerald-200 animate-pulse'
                  : hudData.gloveCooldown > 0
                  ? 'bg-slate-800/80 border-slate-600 text-slate-400'
                  : hudData.stamina < hudData.gloveCost
                  ? 'bg-slate-900/80 border-amber-800/60 text-amber-400'
                  : 'bg-slate-900/80 border-emerald-600/70 text-emerald-300'
              }`}>
                <span className="font-bold">SNAG (Q)</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-black/40">
                  {hudData.stance === GoalieStance.GLOVE_SNAG && hudData.activeTimer > 0
                    ? 'ACTIVE'
                    : hudData.gloveCooldown > 0
                    ? `${hudData.gloveCooldown.toFixed(1)}s`
                    : hudData.stamina < hudData.gloveCost
                    ? 'LOW NRG'
                    : 'READY'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Special Round Indicator */}
        {gameState === GameState.PLAYING && (
          <div className="absolute top-20 w-full text-center pointer-events-none z-10">
            {roundConfig.isSlapShot && <span className="bg-red-600 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">⚠️ SLAP SHOT INCOMING</span>}
            {roundConfig.hasPowerUp && <span className="bg-yellow-500 text-black px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">⚡ SUPER SPEED ACTIVE</span>}
            {roundConfig.hasMagnet && <span className="bg-green-500 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">🧲 MAGNET ACTIVE</span>}
            {currentRound === 7 && <span className="bg-purple-600 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">↩️ CURVE BALL</span>}
          </div>
        )}

        {/* Desktop Controls Overlay */}
        {gameState === GameState.PLAYING && (
          <div className="hidden md:block absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white p-2.5 rounded-lg text-xs z-10 pointer-events-none border border-slate-700/60 shadow-lg select-none">
            <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1 tracking-wider">CONTROLS</p>
            <p>Move: <span className="font-bold text-yellow-400">WASD / Arrows</span></p>
            <p className="mt-1 font-semibold text-slate-300">Stick Position:</p>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-300">
              <span>Up: <b className="text-yellow-400">Z / 1</b></span>
              <span>Mid: <b className="text-yellow-400">X / 2</b></span>
              <span>Low: <b className="text-yellow-400">C / 3</b></span>
            </div>
            <p className="mt-1 font-semibold text-slate-300">Special Moves:</p>
            <div className="grid grid-cols-1 gap-0.5 text-[11px] text-slate-300">
              <span>Poke Check: <b className="text-cyan-400">E / 4</b></span>
              <span>Desperation Dive: <b className="text-amber-400">F / Space / 5</b></span>
              <span>Glove Snag: <b className="text-emerald-400">Q / R / 6</b></span>
              <span>Puck Magnet: <b className="text-indigo-400">M / Shift / 7 (Hold)</b></span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Hitbox Debug: <b className="text-blue-400">H</b></p>
          </div>
        )}

        {/* Canvas */}
        {(gameState === GameState.PLAYING || gameState === GameState.ROUND_WON || gameState === GameState.ROUND_LOST) && (
           <GameCanvas
             roundConfig={roundConfig}
             onRoundEnd={handleRoundEnd}
             hatTrickActive={hatTrickActive}
             octopusActive={octopusActive}
             onHudUpdate={handleHudUpdate}
           />
        )}

        {/* Menu Screen */}
        {gameState === GameState.MENU && (
          <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 md:p-8 z-20 relative">
            <div className="absolute inset-0 border-4 border-blue-600 rounded-lg opacity-50 pointer-events-none"></div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4 md:mb-8 italic transform -skew-x-12">FACE OFF</h2>
            <div className="space-y-4 text-center w-full max-w-lg">
              <p className="text-slate-300 text-sm md:text-base">
                You are the last line of defense. Use your stick positions, special moves
                (Poke, Dive, Glove Snag), and the puck magnet to protect the net.
                The shooter gets smarter, dekes, and curves as rounds progress!
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs md:text-sm text-slate-400 mt-4 bg-slate-900/90 border border-slate-700/50 p-3 md:p-4 rounded-lg">
                <div>
                  <div className="font-bold text-red-400">Round 4</div>
                  <div className="text-[11px] text-slate-300">Slap Shots</div>
                </div>
                <div>
                   <div className="font-bold text-indigo-400">Round 5–10</div>
                   <div className="text-[11px] text-slate-300">Puck Magnet</div>
                </div>
                <div>
                   <div className="font-bold text-purple-400">Round 7</div>
                   <div className="text-[11px] text-slate-300">Heavy Curve</div>
                </div>
                <div>
                   <div className="font-bold text-yellow-400">Round 9</div>
                   <div className="text-[11px] text-slate-300">Speed Boost</div>
                </div>
              </div>
              <div className="py-6">
                <button 
                  onClick={startGame}
                  className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full text-xl md:text-2xl transition-all transform hover:scale-105 shadow-lg hover:shadow-red-500/50"
                >
                  START GAME
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Round Result Overlay */}
        {(gameState === GameState.ROUND_WON || gameState === GameState.ROUND_LOST) && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20 p-4">
            <h2 className={`text-4xl md:text-6xl font-black mb-4 ${gameState === GameState.ROUND_WON ? 'text-green-500' : 'text-red-500'}`}>
              {gameState === GameState.ROUND_WON ? 'SAVE!' : 'GOAL!'}
            </h2>
            
            <div className="bg-slate-800 p-4 md:p-6 rounded-xl border border-slate-600 max-w-lg w-full text-center mb-8 shadow-xl">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Coach's Commentary</p>
              {loadingCommentary ? (
                 <div className="animate-pulse h-6 bg-slate-700 rounded w-3/4 mx-auto"></div>
              ) : (
                 <p className="text-lg md:text-xl text-white font-medium italic">"{commentary}"</p>
              )}
            </div>

            <button 
              onClick={proceedToNextOrEnd}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-lg md:text-xl transition-colors shadow-lg"
            >
              {currentRound >= 10 ? 'Finish Game' : 'Next Round ->'}
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === GameState.GAME_OVER && (
          <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 z-20 border-4 border-yellow-500 rounded-lg">
             <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 text-center">CAREER OVER</h2>
             <div className="text-center mb-8">
               <p className="text-xl md:text-2xl text-slate-300">Final Score</p>
               <p className="text-6xl md:text-8xl font-black text-yellow-400 my-2">{score} <span className="text-2xl md:text-4xl text-slate-500">/ 10</span></p>
               <p className="text-slate-400 mt-4 text-sm md:text-base">
                 {score === 10 ? "LEGENDARY STATUS ACHIEVED" : score > 7 ? "ELITE GOALTENDING" : score > 4 ? "ROOKIE NUMBERS" : "TIME TO HANG UP THE SKATES"}
               </p>
             </div>
             <button 
                onClick={resetGame}
                className="px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded text-lg"
             >
               Back to Menu
             </button>
          </div>
        )}

        {/* Round Transition Wipe */}
        {gameState === GameState.ROUND_TRANSITION && (
          <div className="absolute inset-0 bg-blue-600 z-30 animate-screen-wipe"></div>
        )}
      </div>

      {/* Mobile Controls */}
      {(gameState === GameState.PLAYING) && (
        <div className="w-full max-w-[800px] mt-4 px-4 flex flex-col gap-3 select-none">
           {/* Top row: Movement D-Pad + Stick Controls */}
           <div className="grid grid-cols-2 gap-4">
              {/* Movement D-Pad area */}
              <div className="grid grid-cols-3 gap-2">
                 <div></div>
                 <TouchButton code="ArrowUp" label="↑" sub="Up" />
                 <div></div>
                 
                 <TouchButton code="ArrowLeft" label="←" sub="Left" />
                 <TouchButton code="ArrowDown" label="↓" sub="Down" />
                 <TouchButton code="ArrowRight" label="→" sub="Right" />
              </div>

              {/* Stick Controls */}
              <div className="grid grid-rows-3 gap-2">
                <TouchButton code="Digit1" label="Stick UP" color="bg-orange-700" sub="High Block" />
                <TouchButton code="Digit2" label="Stick MID" color="bg-orange-600" sub="Standard" />
                <TouchButton code="Digit3" label="Stick LOW" color="bg-orange-700" sub="Paddle Down" />
              </div>
           </div>

           {/* Abilities Row: Poke Check, Desperation Dive, Glove Snag, Magnet */}
           <div className="grid grid-cols-4 gap-2">
             <TouchButton code="KeyE" label="POKE" color="bg-cyan-700" sub="Check (E)" />
             <TouchButton code="KeyF" label="DIVE" color="bg-amber-700" sub="Burst (F)" />
             <TouchButton code="KeyQ" label="SNAG" color="bg-emerald-700" sub="Glove (Q)" />
             <TouchButton
               code="KeyM"
               label="MAGNET"
               color={roundConfig.hasMagnet ? "bg-indigo-700" : "bg-slate-700 opacity-50"}
               sub={roundConfig.hasMagnet ? "Hold (M)" : "Locked (R5+)"}
             />
           </div>
        </div>
      )}
    </div>
  );
};

export default App;