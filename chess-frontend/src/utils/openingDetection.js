// Shared opening book and detection utility
// Extracted from videoExportUtils.js for reuse across GameReview, video export, etc.

export const OPENING_BOOK = [
  { moves: ['e4','e5','Nf3','Nc6','Bb5'], name: 'Ruy Lopez' },
  { moves: ['e4','e5','Nf3','Nc6','Bc4'], name: 'Italian Game' },
  { moves: ['e4','e5','Nf3','Nc6','d4'], name: 'Scotch Game' },
  { moves: ['e4','c5','Nf3','d6','d4'], name: 'Sicilian Najdorf' },
  { moves: ['e4','c5','Nf3','Nc6','d4'], name: 'Sicilian Open' },
  { moves: ['d4','d5','c4','e6','Nc3'], name: "Queen's Gambit Declined" },
  { moves: ['d4','d5','c4','dxc4'], name: "Queen's Gambit Accepted" },
  { moves: ['d4','Nf6','c4','g6','Nc3'], name: "King's Indian Defense" },
  { moves: ['d4','Nf6','c4','e6','Nc3','Bb4'], name: 'Nimzo-Indian Defense' },
  { moves: ['e4','e5','Nf3','Nf6'], name: "Petrov's Defense" },
  { moves: ['e4','e5','f4'], name: "King's Gambit" },
  { moves: ['e4','e5','Nc3'], name: 'Vienna Game' },
  { moves: ['d4','Nf6','c4','c5'], name: 'Benoni Defense' },
  { moves: ['e4','c5'], name: 'Sicilian Defense' },
  { moves: ['e4','e6'], name: 'French Defense' },
  { moves: ['e4','c6'], name: 'Caro-Kann Defense' },
  { moves: ['e4','d5'], name: 'Scandinavian Defense' },
  { moves: ['e4','g6'], name: 'Modern Defense' },
  { moves: ['e4','d6'], name: 'Pirc Defense' },
  { moves: ['e4','Nf6'], name: "Alekhine's Defense" },
  { moves: ['d4','d5','c4'], name: "Queen's Gambit" },
  { moves: ['d4','f5'], name: 'Dutch Defense' },
  { moves: ['d4','Nf6','c4','g6'], name: "King's Indian" },
  { moves: ['Nf3','d5','g3'], name: "King's Indian Attack" },
  { moves: ['c4'], name: 'English Opening' },
  { moves: ['Nf3'], name: 'Reti Opening' },
  { moves: ['e4','e5'], name: "King's Pawn Game" },
  { moves: ['d4','d5'], name: "Queen's Pawn Game" },
  { moves: ['d4','Nf6'], name: 'Indian Defense' },
].sort((a, b) => b.moves.length - a.moves.length);

export const detectOpening = (sanMoves) => {
  for (const opening of OPENING_BOOK) {
    if (opening.moves.length <= sanMoves.length &&
        opening.moves.every((m, i) => sanMoves[i] === m)) {
      return opening.name;
    }
  }
  return null;
};
