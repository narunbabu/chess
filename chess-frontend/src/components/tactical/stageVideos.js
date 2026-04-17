// Stage tutorial video configuration.
// After generating videos with ChessVideoGen and uploading to YouTube,
// paste the YouTube video ID into the youtubeId field for each stage.
// Set youtubeId to null to hide the video button for that stage.

export const STAGE_VIDEOS = {
  0: {
    youtubeId: null, // TODO: generate with ChessVideoGen — see chess-backend/database/videogen/
    title: 'Beginner Tactics: Forks, Pins & Back Rank Mates',
    description: 'How to spot basic tactical patterns that win material.',
  },
  1: {
    youtubeId: null, // TODO: replace with YouTube ID after upload
    title: 'Stage 1: Tactical Sharpness (1400→1650)',
    description: 'Stop missing double attacks and discovered checks.',
  },
  2: {
    youtubeId: null,
    title: 'Stage 2: Calculation Depth (1650→1900)',
    description: 'Mastering zwischenzug, deflection, and forcing moves.',
  },
  3: {
    youtubeId: null,
    title: 'Stage 3: Positional Tactics (1900→2100)',
    description: 'Overloaded pieces, trapped pieces, and quiet killers.',
  },
  4: {
    youtubeId: null,
    title: 'Stage 4: Master Calculation (2100→2200+)',
    description: 'Deep forced lines, zugzwang, and endgame tactics.',
  },
};
