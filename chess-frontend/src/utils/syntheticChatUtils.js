/**
 * Synthetic chess opponent chat utilities.
 * Generates personality-driven chat responses for AI opponents.
 */

// Response probability per personality (0-1)
const RESPONSE_PROBABILITY = {
  aggressive: 0.5,
  defensive: 0.2,
  balanced: 0.3,
  tactical: 0.25,
  positional: 0.25,
  default: 0.3,
};

// Delay range [min, max] in ms per personality
const DELAY_RANGE = {
  aggressive: [800, 2000],
  defensive: [3000, 6000],
  balanced: [1500, 3500],
  tactical: [2000, 4000],
  positional: [2500, 5000],
  default: [1500, 3500],
};

export const PERSONALITY_RESPONSES = {
  aggressive: {
    game_start: [
      "Let's go! I'm not holding back.",
      "Hope you're ready for a fight!",
      "Time to crush some pieces.",
    ],
    player_move_good: [
      "Not bad... but I've seen better.",
      "Okay, you've got some fire. Let's see if it lasts.",
      "Interesting. My turn now.",
    ],
    player_move_blunder: [
      "Ha! That's what I was waiting for!",
      "Big mistake. You'll regret that.",
      "Thanks for the gift!",
      "Oh no... that's going to hurt.",
    ],
    opponent_capture: [
      "Gotcha!",
      "One down, more to go!",
      "Your pieces are mine!",
      "Too easy.",
    ],
    player_chat: [
      "Less talking, more playing!",
      "Save the chat for after I win.",
      "Focus on the board!",
    ],
    onPlayerChat_goodluck: [
      "You'll need it more than me!",
      "Luck won't save you.",
      "I make my own luck.",
    ],
    onPlayerChat_nicemove: [
      "I know.",
      "Wait till you see the next one.",
      "That was nothing.",
    ],
    onPlayerChat_goodgame: [
      "It will be... for me.",
      "We'll see about that.",
    ],
    onPlayerChat_wellplayed: [
      "Obviously.",
      "I always play well.",
    ],
    onPlayerChat_thanks: [
      "Don't thank me yet.",
      "Save it.",
    ],
    onPlayerChat_rematch: [
      "Bring it! I'll crush you again!",
      "Absolutely. I want another win.",
      "Let's go, round two!",
    ],
    player_ping: [
      "I'm here! Chill out.",
      "Relax, I'm thinking of my next attack.",
      "Don't rush me!",
    ],
    game_end_win: [
      "Dominated. As expected.",
      "Better luck next time!",
      "GG. That was fun... for me.",
    ],
    game_end_lose: [
      "Ugh! Rematch. NOW.",
      "You got lucky. Again!",
      "Fine, you win this round...",
    ],
    game_end_draw: [
      "A draw? That's boring. Rematch!",
      "I should have won that. Let's go again.",
      "Not satisfied. Another game?",
    ],
  },

  defensive: {
    game_start: [
      "Good luck! Let's have a clean game.",
      "May the best player win.",
      "Ready when you are.",
    ],
    player_move_good: [
      "That's a solid move.",
      "Well played, I need to be careful here.",
      "Good one. Let me think...",
    ],
    player_move_blunder: [
      "Hmm, are you sure about that?",
      "Interesting choice...",
      "I'll take the opportunity, sorry!",
    ],
    opponent_capture: [
      "Had to take that, sorry.",
      "Forced my hand there.",
      "That was necessary.",
    ],
    player_chat: [
      "Thanks for chatting!",
      "Nice to play with you.",
    ],
    onPlayerChat_goodluck: [
      "Thank you, same to you!",
      "Good luck to you too!",
      "Thanks, let's have fun.",
    ],
    onPlayerChat_nicemove: [
      "Oh, thank you! I was nervous about it.",
      "Thanks! I spent a while thinking on that.",
    ],
    onPlayerChat_goodgame: [
      "It really is! Enjoying this.",
      "Agreed, thanks!",
    ],
    onPlayerChat_wellplayed: [
      "That's kind of you, thanks!",
      "You're playing well too!",
    ],
    onPlayerChat_thanks: [
      "Of course!",
      "No problem at all.",
    ],
    onPlayerChat_rematch: [
      "Sure, if you'd like!",
      "I'd be happy to play again.",
    ],
    player_ping: [
      "Sorry, just thinking carefully!",
      "Taking my time, hope that's okay.",
    ],
    game_end_win: [
      "Good game! You played well.",
      "Thanks for the game!",
      "That was close, well played.",
    ],
    game_end_lose: [
      "Well played, you deserved that win.",
      "Good game! I learned a lot.",
      "Congrats, nicely done.",
    ],
    game_end_draw: [
      "Fair result! Good game.",
      "A draw feels right for this one.",
      "Well matched! Good game.",
    ],
  },

  balanced: {
    game_start: [
      "Hey! Let's have a good game.",
      "Good luck, have fun!",
      "Ready to play!",
    ],
    player_move_good: [
      "Nice move!",
      "Solid. I need to respond carefully.",
      "Good stuff, let's see...",
    ],
    player_move_blunder: [
      "Ooh, I think I can exploit that.",
      "Not your best move, I think!",
      "I'll take advantage of that.",
    ],
    opponent_capture: [
      "Needed to grab that.",
      "Exchanges are part of the game!",
      "That trade works for me.",
    ],
    player_chat: [
      "Hey! Good chatting with you.",
      "Fun game so far!",
      "Right back at you!",
    ],
    onPlayerChat_goodluck: [
      "Thanks, you too!",
      "Good luck! Let's enjoy it.",
    ],
    onPlayerChat_nicemove: [
      "Thanks! Felt good about that one.",
      "Appreciate it!",
    ],
    onPlayerChat_goodgame: [
      "Agreed! Fun so far.",
      "Yeah, great game!",
    ],
    onPlayerChat_wellplayed: [
      "Thanks, you too!",
      "Appreciate that!",
    ],
    onPlayerChat_thanks: [
      "Anytime!",
      "No worries!",
    ],
    onPlayerChat_rematch: [
      "Sure, let's go again!",
      "Down for another one!",
      "Why not? Let's play!",
    ],
    player_ping: [
      "Yep, still here! Just thinking.",
      "On it, one sec!",
    ],
    game_end_win: [
      "GG! That was fun.",
      "Good game, well played!",
      "Thanks for the match!",
    ],
    game_end_lose: [
      "GG! You outplayed me.",
      "Well done, solid game.",
      "Good game, you earned it!",
    ],
    game_end_draw: [
      "Good game! Fair draw.",
      "Well fought! Even match.",
      "GG, solid play from both sides.",
    ],
  },

  tactical: {
    game_start: [
      "Let's see who calculates better.",
      "Time for some sharp play!",
      "I love a complex position. Let's go.",
    ],
    player_move_good: [
      "You saw that line? Impressive.",
      "Sharp! I need to recalculate.",
      "Good tactical awareness.",
    ],
    player_move_blunder: [
      "Missed the tactic there!",
      "That drops material, I think...",
      "Oops, I see a combination now!",
      "The position just shifted in my favor.",
    ],
    opponent_capture: [
      "Forced sequence.",
      "The tactic was there, had to play it.",
      "Calculated that three moves ago.",
    ],
    player_chat: [
      "Chatting while I calculate!",
      "Sure, let's talk tactics.",
    ],
    onPlayerChat_goodluck: [
      "Luck is for the unprepared! But thanks.",
      "May the sharper player win.",
    ],
    onPlayerChat_nicemove: [
      "Thanks, the key was the intermediate move.",
      "Glad you saw it was good!",
    ],
    onPlayerChat_goodgame: [
      "Complex and fun!",
      "Yeah, lots of tactics in this one.",
    ],
    onPlayerChat_wellplayed: [
      "Thanks! Some tricky lines in there.",
      "You too, sharp play!",
    ],
    onPlayerChat_thanks: ["No problem!", "Sure thing."],
    onPlayerChat_rematch: [
      "Yes! I want to try a different opening.",
      "Let's go, I have ideas.",
    ],
    player_ping: [
      "Calculating a deep line, hang on...",
      "There's a lot to consider here!",
    ],
    game_end_win: [
      "The tactics worked out! GG.",
      "Good game, some sharp moments.",
    ],
    game_end_lose: [
      "You out-calculated me. Respect.",
      "Missed something. Good game though!",
    ],
    game_end_draw: [
      "Balanced tactics on both sides. Good game.",
      "Neither of us blinked! Fair draw.",
    ],
  },

  positional: {
    game_start: [
      "Let's play a deep, strategic game.",
      "Slow and steady. Good luck.",
      "Looking forward to a positional battle.",
    ],
    player_move_good: [
      "Strong positional understanding.",
      "That improves your structure nicely.",
      "Patient move. I respect that.",
    ],
    player_move_blunder: [
      "That weakens your pawn structure.",
      "Hmm, that square is now vulnerable.",
      "I think the position favors me now.",
    ],
    opponent_capture: [
      "Trading to improve my structure.",
      "That exchange favors my endgame.",
      "Strategic simplification.",
    ],
    player_chat: [
      "Enjoying the positional ideas here.",
      "Good conversation, good chess.",
    ],
    onPlayerChat_goodluck: [
      "Thank you. Preparation beats luck!",
      "Same to you. Let's play solid chess.",
    ],
    onPlayerChat_nicemove: [
      "Thanks, it was a positional decision.",
      "Appreciate it. The structure called for it.",
    ],
    onPlayerChat_goodgame: [
      "Agreed, great strategic battle.",
      "Yes, really instructive game.",
    ],
    onPlayerChat_wellplayed: [
      "Thank you, your play was solid too.",
      "Mutual respect! Good game.",
    ],
    onPlayerChat_thanks: ["My pleasure.", "Of course."],
    onPlayerChat_rematch: [
      "I'd enjoy another strategic battle.",
      "Sure, let's explore another opening.",
    ],
    player_ping: [
      "Evaluating the long-term plan...",
      "Patience is a virtue in chess!",
    ],
    game_end_win: [
      "The position was in my favor. GG.",
      "Solid strategy paid off. Good game!",
    ],
    game_end_lose: [
      "Your positional play was superior. GG.",
      "Well played, better structure won.",
    ],
    game_end_draw: [
      "A well-balanced game. Fair result.",
      "Neither side had a real advantage. Good game!",
    ],
  },

  default: {
    game_start: [
      "Good luck, have fun!",
      "Let's play!",
      "Ready to go!",
    ],
    player_move_good: [
      "Nice move!",
      "Good one!",
      "Impressive!",
    ],
    player_move_blunder: [
      "Hmm, interesting choice.",
      "I think I can use that!",
      "Oops!",
    ],
    opponent_capture: [
      "Got one!",
      "Mine now!",
      "Captured!",
    ],
    player_chat: [
      "Hey!",
      "Hi there!",
      "Good chatting!",
    ],
    onPlayerChat_goodluck: [
      "Thanks, you too!",
      "Good luck!",
    ],
    onPlayerChat_nicemove: [
      "Thanks!",
      "Appreciate it!",
    ],
    onPlayerChat_goodgame: [
      "Agreed!",
      "Yeah, good game!",
    ],
    onPlayerChat_wellplayed: [
      "Thanks, you too!",
      "Appreciate that!",
    ],
    onPlayerChat_thanks: ["No problem!", "Sure!"],
    onPlayerChat_rematch: [
      "Sure, let's go!",
      "Why not!",
    ],
    player_ping: [
      "I'm here!",
      "Still thinking!",
    ],
    game_end_win: [
      "Good game!",
      "GG, well played!",
    ],
    game_end_lose: [
      "Good game! You played well.",
      "Well done!",
    ],
    game_end_draw: [
      "Good game! Fair draw.",
      "Well played by both!",
    ],
  },
};

export const QUICK_MESSAGES = [
  "Good luck!",
  "Good game!",
  "Nice move!",
  "Well played!",
  "Thanks!",
  "Rematch?",
];

export const EMOJI_REACTIONS = [
  { emoji: "\u{1F44D}", label: "thumbs up" },
  { emoji: "\u{1F525}", label: "fire" },
  { emoji: "\u{1F62E}", label: "wow" },
  { emoji: "\u{1F914}", label: "thinking" },
  { emoji: "\u{1F4AA}", label: "strong" },
  { emoji: "\u{1F605}", label: "phew" },
];

// Map quick messages to trigger keys for player_chat events
const QUICK_MESSAGE_TRIGGER_MAP = {
  "Good luck!": "onPlayerChat_goodluck",
  "Good game!": "onPlayerChat_goodgame",
  "Nice move!": "onPlayerChat_nicemove",
  "Well played!": "onPlayerChat_wellplayed",
  "Thanks!": "onPlayerChat_thanks",
  "Rematch?": "onPlayerChat_rematch",
};

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a chat response for the given personality and trigger.
 * Falls back to 'default' personality if the requested one doesn't exist
 * or doesn't have the trigger.
 */
export function getOpponentResponse(personality, trigger) {
  const pool =
    PERSONALITY_RESPONSES[personality]?.[trigger] ||
    PERSONALITY_RESPONSES.default?.[trigger];

  if (!pool || pool.length === 0) return null;
  return randomFromArray(pool);
}

/**
 * Determine whether the AI opponent should auto-respond to a game event.
 * Returns { shouldRespond, trigger, delay } based on personality and event type.
 */
export function shouldAutoRespond(personality, gameEvent) {
  const prob = RESPONSE_PROBABILITY[personality] ?? RESPONSE_PROBABILITY.default;
  const [delayMin, delayMax] = DELAY_RANGE[personality] ?? DELAY_RANGE.default;

  // Map game events to response triggers
  const eventTriggerMap = {
    game_start: "game_start",
    player_move_good: "player_move_good",
    player_move_blunder: "player_move_blunder",
    opponent_capture: "opponent_capture",
    player_chat: "player_chat",
    player_ping: "player_ping",
    game_end_win: "game_end_win",
    game_end_lose: "game_end_lose",
    game_end_draw: "game_end_draw",
  };

  const trigger = eventTriggerMap[gameEvent];
  if (!trigger) {
    return { shouldRespond: false, trigger: null, delay: 0 };
  }

  // Some events always trigger (game_start, game_end, player_ping)
  const alwaysRespond = [
    "game_start",
    "game_end_win",
    "game_end_lose",
    "game_end_draw",
    "player_ping",
  ];

  const roll = Math.random();
  const shouldRespond = alwaysRespond.includes(gameEvent)
    ? roll < Math.min(prob * 2, 0.9) // higher chance but not guaranteed
    : roll < prob;

  return {
    shouldRespond,
    trigger,
    delay: randomInRange(delayMin, delayMax),
  };
}

/**
 * Resolve a player's quick message to a personality-specific trigger key.
 * Use with getOpponentResponse for contextual replies.
 */
export function resolveQuickMessageTrigger(message) {
  return QUICK_MESSAGE_TRIGGER_MAP[message] || "player_chat";
}
