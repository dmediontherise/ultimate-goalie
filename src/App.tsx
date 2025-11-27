import React, { useState, useMemo, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, RoundConfig, StickPosition, SaveType } from './types';
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

  const roundConfig: RoundConfig = useMemo(() => {
    // Difficulty progression curve
    const ratio = (currentRound - 1) / 9; // 0 to 1
    
    let shotSpeed = 8 + ratio * 12; // Base: 8 to 20
    let shooterSpeed = 2 + ratio * 4; // Base: 2 to 6
    let curveFactor = ratio > 0.5 ? (ratio - 0.5) * 2 : 0; // Starts curving at round 5
    const isSlapShot = currentRound === 4;
    const hasPowerUp = currentRound === 9;
    const hasMagnet = currentRound === 5;

    // Special Round Logic
    if (isSlapShot) {
      shotSpeed *= 1.2; // 20% faster
    }

    if (currentRound === 7) {
      curveFactor = 1.5; // Heavy curve
    }

    return {
      roundNumber: currentRound,
      shooterSpeed,
      shotSpeed,
      aiIntelligence: 0.2 + ratio * 0.8, // 0.2 to 1.0
      curveFactor,
      jitter: ratio * 0.8, // Increases erratic movement
      isSlapShot,
      hasPowerUp,
      hasMagnet,
    };
  }, [currentRound]);
  
  // Effect for round transition
  const nextRound = useCallback(() => {
    console.log('App:nextRound - Proceeding to next round');
    setCurrentRound(prev => prev + 1);
    setGameState(GameState.PLAYING);
  }, []);

  useEffect(() => {
    console.log('App:useEffect - gameState changed to', gameState);
    if (gameState === GameState.ROUND_TRANSITION) {
      console.log('App:useEffect - Starting round transition timer');
      const timer = setTimeout(() => {
        nextRound();
      }, 500); // Duration of the wipe animation
      return () => clearTimeout(timer);
    }
  }, [gameState, nextRound]);


  const startGame = () => {
    console.log('App:startGame - Starting game');
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
    console.log('App:handleRoundEnd - Round ended. Success:', success, 'SaveType:', saveType);
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
    console.log('App:handleRoundEnd - Fetching AI commentary');
    
    let shotType = "";
    if (roundConfig.isSlapShot) shotType = "Slap Shot";
    if (roundConfig.hasPowerUp) shotType = "Power Shot";
    if (currentRound === 7) shotType = "Curveball";

    const text = await getCommentary(currentRound, success, shotType, saveType);
    console.log('App:handleRoundEnd - Commentary received:', text);
    setCommentary(text);
    setLoadingCommentary(false);
  }, [roundConfig, consecutiveSaves, consecutiveAIScores]);

  const proceedToNextOrEnd = useCallback(() => {
    console.log('App:proceedToNextOrEnd - Proceeding to next round or ending game');
    if (currentRound >= 10) {
      setGameState(GameState.GAME_OVER);
    } else {
      setGameState(GameState.ROUND_TRANSITION);
    }
  }, [currentRound]);

  const resetGame = useCallback(() => {
    console.log('App:resetGame - Resetting game');
    setGameState(GameState.MENU);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-900 font-sans relative overflow-y-auto pb-8">
      
      {/* Header */}
      <div className="py-4 text-center shrink-0">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-500 tracking-widest uppercase drop-shadow-lg">Ultimate Goalie v2</h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1">Defend the net against the AI machine</p>
      </div>

      {/* Game Container */}
      <div className="w-full max-w-[800px] aspect-[4/3] relative shrink-0 shadow-2xl rounded-lg overflow-hidden bg-slate-800 mx-auto">
        
        {/* HUD */}
        {gameState !== GameState.MENU && gameState !== GameState.GAME_OVER && (
          <div className="absolute top-4 left-4 right-4 flex justify-between text-sm md:text-xl font-mono font-bold z-10 text-slate-800 pointer-events-none select-none">
            <div className="bg-white/80 px-3 py-1 rounded shadow">Round: {currentRound}/10</div>
            <div className="bg-white/80 px-3 py-1 rounded shadow">Saves: {score}</div>
          </div>
        )}

        {/* Special Round Indicator */}
        {gameState === GameState.PLAYING && (
          <div className="absolute top-16 w-full text-center pointer-events-none z-10">
            {roundConfig.isSlapShot && <span className="bg-red-600 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">⚠️ SLAP SHOT INCOMING</span>}
            {roundConfig.hasPowerUp && <span className="bg-yellow-500 text-black px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">⚡ SUPER SPEED ACTIVE</span>}
            {roundConfig.hasMagnet && <span className="bg-green-500 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">🧲 MAGNET ACTIVE</span>}
            {currentRound === 7 && <span className="bg-purple-600 text-white px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm shadow animate-pulse">↩️ CURVE BALL</span>}
          </div>
        )}

        {/* Desktop Controls Overlay */}
        {gameState === GameState.PLAYING && (
          <div className="hidden md:block absolute bottom-4 right-4 bg-black/50 text-white p-3 rounded text-xs z-10 pointer-events-none">
            <p>Move: <span className="font-bold text-yellow-400">WASD / Arrows</span></p>
            <p className="mt-1">Stick:</p>
            <ul className="list-disc list-inside text-slate-300">
              <li>Up: <span className="font-bold text-yellow-400">Z / 1</span></li>
              <li>Mid: <span className="font-bold text-yellow-400">X / 2</span></li>
              <li>Down: <span className="font-bold text-yellow-400">C / 3</span></li>
            </ul>
          </div>
        )}

        {/* Canvas */}
        {(gameState === GameState.PLAYING || gameState === GameState.ROUND_WON || gameState === GameState.ROUND_LOST) && (
           <GameCanvas roundConfig={roundConfig} onRoundEnd={handleRoundEnd} hatTrickActive={hatTrickActive} octopusActive={octopusActive} />
        )}

        {/* Menu Screen */}
        {gameState === GameState.MENU && (
          <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 md:p-8 z-20 relative">
            <div className="absolute inset-0 border-4 border-blue-600 rounded-lg opacity-50 pointer-events-none"></div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4 md:mb-8 italic transform -skew-x-12">FACE OFF</h2>
            <div className="space-y-4 text-center w-full max-w-md">
              <p className="text-slate-300 text-sm md:text-lg">
                You are the last line of defense. 
                Use your stick and body to stop the puck. 
                The AI gets smarter and faster every round.
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs md:text-sm text-slate-400 mt-4 bg-slate-900 p-4 rounded-lg">
                <div>
                  <div className="font-bold text-red-400">Round 4</div>
                  <div>Slap Shots</div>
                </div>
                <div>
                   <div className="font-bold text-purple-400">Round 7</div>
                   <div>Curved Shots</div>
                </div>
                <div>
                   <div className="font-bold text-yellow-400">Round 9</div>
                   <div>Speed Boost</div>
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
        <div className="w-full max-w-[800px] mt-4 px-4 grid grid-cols-2 gap-8 select-none">
           {/* Movement D-Pad area */}
           <div className="grid grid-cols-3 gap-2">
              <div></div>
              <TouchButton code="ArrowUp" label="↑" />
              <div></div>
              
              <TouchButton code="ArrowLeft" label="←" />
              <TouchButton code="ArrowDown" label="↓" />
              <TouchButton code="ArrowRight" label="→" />
           </div>

           {/* Stick Controls */}
           <div className="grid grid-rows-3 gap-2">
             <TouchButton code="Digit1" label="Stick UP" color="bg-orange-700" sub="High Block" />
             <TouchButton code="Digit2" label="Stick MID" color="bg-orange-600" sub="Standard" />
             <TouchButton code="Digit3" label="Stick LOW" color="bg-orange-700" sub="Paddle Down" />
           </div>
        </div>
      )}
    </div>
  );
};

export default App;