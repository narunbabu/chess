import React, { useState, useEffect, useRef } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Puzzle } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Lightbulb, RefreshCw, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

interface PuzzleBoardProps {
  puzzle: Puzzle;
  onBack: () => void;
  onComplete: (success: boolean) => void;
  onNext: () => void;
  hasNext: boolean;
}

type Step = 'guided_1' | 'guided_2' | 'playing' | 'success' | 'failed';

export default function PuzzleBoard({ puzzle, onBack, onComplete, onNext, hasNext }: PuzzleBoardProps) {
  const [game, setGame] = useState(new Chess(puzzle.fen));
  const [step, setStep] = useState<Step>('guided_1');
  const [moveIndex, setMoveIndex] = useState(0);
  const [candidateMoves, setCandidateMoves] = useState('');
  const [opponentThreats, setOpponentThreats] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Reset when puzzle changes
  useEffect(() => {
    setGame(new Chess(puzzle.fen));
    setStep('guided_1');
    setMoveIndex(0);
    setCandidateMoves('');
    setOpponentThreats('');
    setFeedback(null);
  }, [puzzle]);

  const makeMove = (move: string | { from: string, to: string, promotion?: string }) => {
    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move(move);
      setGame(gameCopy);
      return result;
    } catch (e) {
      return null;
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (step !== 'playing') return false;

    const expectedMoveSan = puzzle.moves[moveIndex];
    
    // Try to make the move
    const gameCopy = new Chess(game.fen());
    let moveObj: Move | null = null;
    try {
      moveObj = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: (piece && piece[1]) ? piece[1].toLowerCase() : 'q',
      });
    } catch (e) {
      return false;
    }

    if (moveObj === null) return false;

    // Check if the move matches the solution
    // We need to check if the SAN of the user's move matches the expected SAN
    if (moveObj.san === expectedMoveSan) {
      setGame(gameCopy);
      setFeedback({ type: 'success', message: 'Correct move!' });
      
      const nextIndex = moveIndex + 1;
      setMoveIndex(nextIndex);

      if (nextIndex >= puzzle.moves.length) {
        setStep('success');
        setFeedback({ type: 'success', message: 'Puzzle Solved! ' + puzzle.explanation });
        onComplete(true);
      } else {
        // Opponent's turn
        setTimeout(() => {
          const opponentMoveSan = puzzle.moves[nextIndex];
          const gameAfterOpponent = new Chess(gameCopy.fen());
          gameAfterOpponent.move(opponentMoveSan);
          setGame(gameAfterOpponent);
          setMoveIndex(nextIndex + 1);
          setFeedback({ type: 'info', message: 'Your turn.' });
          
          if (nextIndex + 1 >= puzzle.moves.length) {
             setStep('success');
             setFeedback({ type: 'success', message: 'Puzzle Solved! ' + puzzle.explanation });
             onComplete(true);
          }
        }, 500);
      }
      return true;
    } else {
      setFeedback({ type: 'error', message: 'Incorrect move. Try again.' });
      setStep('failed');
      onComplete(false);
      return false;
    }
  };

  const handleRetry = () => {
    setGame(new Chess(puzzle.fen));
    setStep('playing');
    setMoveIndex(0);
    setFeedback(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Board */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[600px] bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full shadow-inner",
                  puzzle.playerColor === 'w' ? "bg-white border-2 border-slate-300" : "bg-slate-900"
                )} />
                <span className="font-semibold text-slate-700">
                  {puzzle.playerColor === 'w' ? 'White' : 'Black'} to move
                </span>
              </div>
              <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {puzzle.difficulty.toUpperCase()}
              </div>
            </div>
            
            <Chessboard 
              options={{
                position: game.fen(),
                onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                  if (!targetSquare) return false;
                  return onDrop(sourceSquare, targetSquare, piece.pieceType);
                },
                boardOrientation: puzzle.playerColor === 'w' ? 'white' : 'black',
                darkSquareStyle: { backgroundColor: '#779556' },
                lightSquareStyle: { backgroundColor: '#ebecd0' },
                animationDurationInMs: 300
              }}
            />
          </div>
        </div>

        {/* Right Column: Guided Thinking & Feedback */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Brain className="text-blue-500" />
              Guided Thinking
            </h2>

            {step === 'guided_1' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <label className="block text-sm font-bold text-slate-700">
                  1. What are the candidate moves?
                </label>
                <p className="text-sm text-slate-500 mb-2">List checks, captures, and threats.</p>
                <textarea 
                  value={candidateMoves}
                  onChange={(e) => setCandidateMoves(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none h-32"
                  placeholder="e.g., Qh6+, Nxf7..."
                />
                <button 
                  onClick={() => setStep('guided_2')}
                  disabled={candidateMoves.trim().length < 3}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next Step
                </button>
              </div>
            )}

            {step === 'guided_2' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <label className="block text-sm font-bold text-slate-700">
                  2. What is the opponent threatening?
                </label>
                <p className="text-sm text-slate-500 mb-2">Identify their active ideas.</p>
                <textarea 
                  value={opponentThreats}
                  onChange={(e) => setOpponentThreats(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none h-32"
                  placeholder="e.g., Mate on g2, attacking my rook..."
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep('guided_1')}
                    className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setStep('playing')}
                    disabled={opponentThreats.trim().length < 3}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Start Solving
                  </button>
                </div>
              </div>
            )}

            {(step === 'playing' || step === 'success' || step === 'failed') && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Your Analysis</h3>
                  <div className="mb-3">
                    <span className="text-xs font-bold text-slate-400 block mb-1">CANDIDATES:</span>
                    <span className="text-sm text-slate-700">{candidateMoves}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-1">THREATS:</span>
                    <span className="text-sm text-slate-700">{opponentThreats}</span>
                  </div>
                </div>

                {feedback && (
                  <div className={cn(
                    "p-4 rounded-xl flex items-start gap-3",
                    feedback.type === 'success' ? "bg-green-50 text-green-800 border border-green-200" :
                    feedback.type === 'error' ? "bg-red-50 text-red-800 border border-red-200" :
                    "bg-blue-50 text-blue-800 border border-blue-200"
                  )}>
                    {feedback.type === 'success' && <CheckCircle2 className="shrink-0 mt-0.5" size={20} />}
                    {feedback.type === 'error' && <XCircle className="shrink-0 mt-0.5" size={20} />}
                    {feedback.type === 'info' && <Lightbulb className="shrink-0 mt-0.5" size={20} />}
                    <p className="font-medium leading-relaxed">{feedback.message}</p>
                  </div>
                )}

                {step === 'failed' && (
                  <button 
                    onClick={handleRetry}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={20} />
                    Retry Puzzle
                  </button>
                )}

                {step === 'success' && (
                  <div className="flex gap-3">
                    <button 
                      onClick={onBack}
                      className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                      Dashboard
                    </button>
                    {hasNext && (
                      <button 
                        onClick={onNext}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                      >
                        Next Puzzle
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Themes</h3>
            <div className="flex flex-wrap gap-2">
              {puzzle.themes.map((theme, i) => (
                <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
