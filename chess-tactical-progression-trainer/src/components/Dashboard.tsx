import React from 'react';
import { stages } from '../data/puzzles';
import { UserStats } from '../types';
import { Lock, Unlock, Target, Brain, Zap, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  stats: UserStats;
  onSelectStage: (stageId: number) => void;
}

const stageIcons = {
  1: Zap,
  2: Brain,
  3: Target,
  4: Trophy
};

export default function Dashboard({ stats, onSelectStage }: DashboardProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
          Tactical Progression
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Train your calculation, pattern recognition, and decision-making to progress from 1600 to 2200 ELO.
        </p>
        
        <div className="mt-8 flex justify-center gap-8">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Current Rating</div>
            <div className="text-3xl font-bold text-slate-900">{stats.rating}</div>
          </div>
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Puzzles Solved</div>
            <div className="text-3xl font-bold text-slate-900">{stats.puzzlesSolved}</div>
          </div>
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Current Streak</div>
            <div className="text-3xl font-bold text-orange-500 flex items-center justify-center gap-2">
              🔥 {stats.currentStreak}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stages.map((stage) => {
          const progress = stats.stageProgress[stage.id];
          const isUnlocked = progress?.unlocked || stage.id === 1;
          const Icon = stageIcons[stage.id as keyof typeof stageIcons];
          const accuracy = progress?.attempted > 0 
            ? Math.round((progress.solved / progress.attempted) * 100) 
            : 0;

          return (
            <div 
              key={stage.id}
              onClick={() => isUnlocked && onSelectStage(stage.id)}
              className={cn(
                "relative bg-white rounded-3xl p-8 border-2 transition-all duration-300",
                isUnlocked 
                  ? "border-slate-200 hover:border-blue-500 hover:shadow-xl cursor-pointer group" 
                  : "border-slate-100 opacity-75 cursor-not-allowed"
              )}
            >
              {!isUnlocked && (
                <div className="absolute top-6 right-6 bg-slate-100 p-2 rounded-full text-slate-400">
                  <Lock size={20} />
                </div>
              )}
              {isUnlocked && (
                <div className="absolute top-6 right-6 bg-blue-50 text-blue-500 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Unlock size={20} />
                </div>
              )}

              <div className="flex items-start gap-4 mb-6">
                <div className={cn(
                  "p-4 rounded-2xl",
                  isUnlocked ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                )}>
                  <Icon size={32} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-1">
                    Stage {stage.id} • {stage.eloRange}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">{stage.title}</h2>
                </div>
              </div>

              <p className="text-slate-600 mb-6 min-h-[48px]">
                {stage.description}
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-slate-900">{progress?.solved || 0} / {stage.puzzleCount}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isUnlocked ? "bg-blue-500" : "bg-slate-300"
                      )}
                      style={{ width: `${Math.min(100, ((progress?.solved || 0) / 100) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {stage.themes.slice(0, 2).map((theme, i) => (
                      <span key={i} className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                        {theme}
                      </span>
                    ))}
                    {stage.themes.length > 2 && (
                      <span className="text-xs font-medium bg-slate-50 text-slate-400 px-2.5 py-1 rounded-md">
                        +{stage.themes.length - 2} more
                      </span>
                    )}
                  </div>
                  {isUnlocked && progress?.attempted > 0 && (
                    <div className="text-sm font-bold text-slate-900">
                      {accuracy}% Acc
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
