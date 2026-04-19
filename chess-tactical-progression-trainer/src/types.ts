export interface Puzzle {
  id: string;
  stage: number;
  fen: string;
  moves: string[]; // Solution moves in SAN (e.g., ["Qh6+", "Kxh6", "Bxf6#"])
  themes: string[];
  difficulty: 'medium' | 'hard' | 'very hard';
  explanation: string;
  playerColor: 'w' | 'b';
}

export interface UserStats {
  rating: number;
  puzzlesAttempted: number;
  puzzlesSolved: number;
  currentStreak: number;
  stageProgress: Record<number, { attempted: number; solved: number; unlocked: boolean }>;
}

export interface Stage {
  id: number;
  title: string;
  eloRange: string;
  description: string;
  themes: string[];
  puzzleCount: string;
}
