import { Puzzle, Stage } from '../types';
import stage1Puzzles from './stage1.json';
import stage2Puzzles from './stage2.json';
import stage3Puzzles from './stage3.json';
import stage4Puzzles from './stage4.json';

export const stages: Stage[] = [
  {
    id: 1,
    title: "Tactical Sharpness Upgrade",
    eloRange: "1600 → 1750",
    description: "Stop missing multi-move tactics. Focus on double attacks, pins, and removing the defender.",
    themes: ["Double attacks", "Pins", "Discovered attacks", "Removing the defender"],
    puzzleCount: "20"
  },
  {
    id: 2,
    title: "Calculation Depth",
    eloRange: "1750 → 1900",
    description: "Calculate forcing lines clearly. Checks, captures, threats, and intermediate moves.",
    themes: ["Checks → captures → threats", "Zwischenzug", "Sacrifices", "Forcing variations"],
    puzzleCount: "20"
  },
  {
    id: 3,
    title: "Positional Tactics",
    eloRange: "1900 → 2050",
    description: "See tactics arising from position, not chaos. Weak squares, overloaded pieces.",
    themes: ["Weak squares", "Overloaded pieces", "Trapped pieces", "Pawn breaks"],
    puzzleCount: "20"
  },
  {
    id: 4,
    title: "Master-Level Calculation",
    eloRange: "2050 → 2200",
    description: "Handle unclear, deep, engine-like positions. Long forcing lines and quiet moves.",
    themes: ["Long forcing lines", "Defensive resources", "Quiet moves", "Endgame tactics"],
    puzzleCount: "20"
  }
];

export const puzzles: Puzzle[] = [
  ...(stage1Puzzles as Puzzle[]),
  ...(stage2Puzzles as Puzzle[]),
  ...(stage3Puzzles as Puzzle[]),
  ...(stage4Puzzles as Puzzle[])
];
