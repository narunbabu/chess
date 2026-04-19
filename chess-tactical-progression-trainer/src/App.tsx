/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import PuzzleBoard from './components/PuzzleBoard';
import { UserStats } from './types';
import { puzzles } from './data/puzzles';

export default function App() {
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  
  const [stats, setStats] = useState<UserStats>({
    rating: 1600,
    puzzlesAttempted: 0,
    puzzlesSolved: 0,
    currentStreak: 0,
    stageProgress: {
      1: { attempted: 0, solved: 0, unlocked: true },
      2: { attempted: 0, solved: 0, unlocked: false },
      3: { attempted: 0, solved: 0, unlocked: false },
      4: { attempted: 0, solved: 0, unlocked: false },
    }
  });

  const handleSelectStage = (stageId: number) => {
    setCurrentStage(stageId);
    setCurrentPuzzleIndex(0); // Start at first puzzle of stage
  };

  const handlePuzzleComplete = (success: boolean) => {
    setStats(prev => {
      const newStats = { ...prev };
      newStats.puzzlesAttempted += 1;
      
      if (currentStage) {
        const stageProg = newStats.stageProgress[currentStage];
        stageProg.attempted += 1;
        
        if (success) {
          newStats.puzzlesSolved += 1;
          newStats.currentStreak += 1;
          newStats.rating += 5;
          stageProg.solved += 1;
          
          // Unlock logic (simplified: if solved 1 puzzle in stage 1, unlock stage 2)
          if (currentStage === 1 && stageProg.solved >= 1) {
            newStats.stageProgress[2].unlocked = true;
          }
        } else {
          newStats.currentStreak = 0;
          newStats.rating = Math.max(1600, newStats.rating - 5);
        }
      }
      
      return newStats;
    });
  };

  const handleBackToDashboard = () => {
    setCurrentStage(null);
  };

  const handleNextPuzzle = () => {
    setCurrentPuzzleIndex(prev => prev + 1);
  };

  // Get puzzles for current stage
  const stagePuzzles = puzzles.filter(p => p.stage === currentStage);
  const currentPuzzle = stagePuzzles[currentPuzzleIndex];
  const hasNext = currentPuzzleIndex < stagePuzzles.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {currentStage === null ? (
        <Dashboard stats={stats} onSelectStage={handleSelectStage} />
      ) : (
        currentPuzzle ? (
          <PuzzleBoard 
            puzzle={currentPuzzle} 
            onBack={handleBackToDashboard} 
            onComplete={handlePuzzleComplete}
            onNext={handleNextPuzzle}
            hasNext={hasNext}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <h2 className="text-2xl font-bold mb-4">No more puzzles in this stage!</h2>
            <button 
              onClick={handleBackToDashboard}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        )
      )}
    </div>
  );
}

