import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { computeCCTFromPuzzle, getLegalTargets, validateCCTEntry, classifyThreatAttempt } from '../../utils/computeCCT';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUCI(uci) {
  return {
    from: uci.slice(0, 2),
    to:   uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

function movesMatch(srcSq, tgtSq, promoPiece, expectedUCI) {
  const e = parseUCI(expectedUCI);
  if (srcSq !== e.from || tgtSq !== e.to) return false;
  if (e.promotion && promoPiece !== e.promotion) return false;
  return true;
}

function applyUCI(chess, uci) {
  const { from, to, promotion } = parseUCI(uci);
  try {
    return chess.move({ from, to, promotion: promotion || 'q' });
  } catch {
    return null;
  }
}

function hintArrow(uci) {
  const { from, to } = parseUCI(uci);
  return [[from, to, 'rgba(129,182,76,0.85)']];
}

// Arrow color per CCT type
const CCT_COLORS = {
  check:   '#ef4444',
  capture: '#5b8dd9',
  threat:  '#c9882a',
};
const CCT_COLORS_DIM = {
  check:   'rgba(239,68,68,0.28)',
  capture: 'rgba(91,141,217,0.28)',
  threat:  'rgba(201,136,42,0.28)',
};

// Mode-specific instruction shown under the step title
const CCT_INSTRUCTIONS = {
  check:   'Click YOUR piece → click the square it moves to (giving check).',
  capture: 'Click YOUR piece → click the opponent\'s piece you can take.',
  threat:  'Click YOUR piece → click where it moves. The engine checks if it then attacks an opponent piece.',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = {
  INTRO_MODAL:  'intro_modal',
  CCT_MY_TURN:  'cct_my',      // find YOUR checks/captures/threats
  CCT_OPPONENT: 'cct_opp',     // find OPPONENT's checks/captures/threats
  PLAYING:      'playing',
  SUCCESS:      'success',
};

const MAX_WRONG = 2;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TacticalPuzzleBoard({
  puzzle,
  puzzleNumber,
  totalPuzzles,
  stageTitle,
  stageVideo,
  onBack,
  onComplete,
  onNext,
  onJumpToPuzzle,
  hasNext,
  ratingDelta,
  puzzleScore,
  completedPuzzleIds = [],
  allStagePuzzles = [],
  puzzleScores = {},
}) {
  // ── Core puzzle state ───────────────────────────────────────────────────────
  const [game,            setGame]            = useState(() => new Chess(puzzle.fen));
  const [step,            setStep]            = useState(STEPS.CCT_MY_TURN);
  const [moveIndex,       setMoveIndex]       = useState(0);
  const [feedback,        setFeedback]        = useState(null);
  const [wrongCount,      setWrongCount]      = useState(0);
  const [wrongAttempts,   setWrongAttempts]   = useState([]); // [{from,to,at}]
  const [showHint,        setShowHint]        = useState(false);
  const [showSolutionBtn, setShowSolutionBtn] = useState(false);
  const [fastMode,        setFastMode]        = useState(false);
  const [showVideo,       setShowVideo]       = useState(false);
  const [showPuzzleList,  setShowPuzzleList]  = useState(false);
  const [wrongSquares,    setWrongSquares]    = useState({});
  const [correctSquares,  setCorrectSquares]  = useState({});
  // ── Solution view (step-by-step navigator, available in PLAYING and SUCCESS) ──
  const [solutionViewMode, setSolutionViewMode] = useState(false);
  const [solutionViewPos,  setSolutionViewPos]  = useState(0);
  const solutionRevealedRef = useRef(false); // tracks if we already penalised for reveal
  const executionPassedRef  = useRef(false); // tracks if puzzle moves were already solved correctly

  // ── CCT score tracking (persists across both CCT phases) ─────────────────────
  const CCT_THRESHOLD = 0.5; // must find ≥50% of CCTs to unlock Solve
  const cctResultRef  = useRef({ myFound: 0, myTotal: 0, oppFound: 0, oppTotal: 0 });

  // Helper: call onComplete with CCT metadata attached
  const completeWithCCT = useCallback((success, wrongs, solutionShown = false) => {
    const r = cctResultRef.current;
    onComplete(success, wrongs, {
      myFound: r.myFound, myTotal: r.myTotal,
      oppFound: r.oppFound, oppTotal: r.oppTotal,
      solutionShown,
    });
  }, [onComplete]);

  // ── CCT state ───────────────────────────────────────────────────────────────
  const [computedCCTs, setComputedCCTs] = useState(null); // { my, opponent }
  const [cctMode,      setCctMode]      = useState('check'); // 'check'|'capture'|'threat'
  const [selectedSq,   setSelectedSq]   = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [cctEntries,   setCctEntries]   = useState([]);    // user-marked CCTs
  const [cctRevealed,  setCctRevealed]  = useState(false); // after clicking "I'm Done"
  const [cctFeedback,  setCctFeedback]  = useState(null);

  // ── PLAYING mode state (for click-click moves) ───────────────────────────────
  const [playingSelectedSq, setPlayingSelectedSq] = useState(null);
  const [playingLegalMoves,  setPlayingLegalMoves]  = useState([]);
  const [showWrongPrompt,   setShowWrongPrompt]   = useState(false); // after wrong move: ask user

  // ── First-visit intro modal ─────────────────────────────────────────────────
  useEffect(() => {
    const seen = localStorage.getItem('cct_intro_seen');
    if (!seen) setStep(STEPS.INTRO_MODAL);
    else setStep(STEPS.CCT_MY_TURN);
  }, []);

  // ── Reset on puzzle change ──────────────────────────────────────────────────
  useEffect(() => {
    setGame(new Chess(puzzle.fen));
    setStep(fastMode ? STEPS.PLAYING : STEPS.CCT_MY_TURN);
    setMoveIndex(0);
    setFeedback(null);
    setWrongCount(0);
    setWrongAttempts([]);
    setShowHint(false);
    setShowSolutionBtn(false);
    setWrongSquares({});
    setCorrectSquares({});
    setSolutionViewMode(false);
    setSolutionViewPos(0);
    solutionRevealedRef.current = false;
    executionPassedRef.current = false;
    // Reset CCT
    setCctEntries([]);
    setCctRevealed(false);
    setSelectedSq(null);
    setLegalTargets([]);
    setCctFeedback(null);
    setCctMode('check');
    // Reset PLAYING mode
    setPlayingSelectedSq(null);
    setPlayingLegalMoves([]);
    setShowWrongPrompt(false);
    // Reset CCT score tracking
    cctResultRef.current = { myFound: 0, myTotal: 0, oppFound: 0, oppTotal: 0 };
    // Compute CCTs: exact checks/captures via chess.js, threats from puzzle solution
    setComputedCCTs(computeCCTFromPuzzle(puzzle));
  }, [puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dismiss intro ───────────────────────────────────────────────────────────
  const dismissIntro = () => {
    localStorage.setItem('cct_intro_seen', '1');
    setStep(STEPS.CCT_MY_TURN);
  };

  // ── Toggle fast mode ────────────────────────────────────────────────────────
  const toggleFastMode = useCallback(() => {
    setFastMode(prev => {
      const next = !prev;
      setGame(new Chess(puzzle.fen));
      setStep(next ? STEPS.PLAYING : STEPS.CCT_MY_TURN);
      setMoveIndex(0);
      setFeedback(null);
      setWrongCount(0);
      setWrongAttempts([]);
      setShowHint(false);
      setShowSolutionBtn(false);
      setWrongSquares({});
      setCorrectSquares({});
      setSolutionViewMode(false);
      setSolutionViewPos(0);
      solutionRevealedRef.current = false;
      setCctEntries([]);
      setCctRevealed(false);
      setSelectedSq(null);
      setLegalTargets([]);
      setCctFeedback(null);
      setPlayingSelectedSq(null);
      setPlayingLegalMoves([]);
      setShowWrongPrompt(false);
      return next;
    });
  }, [puzzle]);

  // ── Square click — for CCT identification AND PLAYING click-click moves ──
  const handleSquareClick = useCallback((square) => {
    if (solutionViewMode) return; // board is read-only while viewing solution

    // ── PLAYING MODE (click-click move support) ───────────────────────────
    if (step === STEPS.PLAYING) {
      // First click: select a piece
      if (!playingSelectedSq) {
        const piece = game.get(square);
        if (!piece) return;
        if (piece.color !== puzzle.playerColor) {
          setFeedback({ type: 'error', message: 'Select your own piece to move.' });
          setTimeout(() => setFeedback(null), 1500);
          return;
        }
        // Get all legal moves for this piece
        const moves = game.moves({ square, verbose: true });
        const moveSquares = moves.map(m => m.to);
        setPlayingSelectedSq(square);
        setPlayingLegalMoves(moveSquares);
        setFeedback(null);
        return;
      }

      // Deselect by clicking the same square
      if (square === playingSelectedSq) {
        setPlayingSelectedSq(null);
        setPlayingLegalMoves([]);
        return;
      }

      // Re-select if clicking another own piece (not a wrong move)
      const clickedPiece = game.get(square);
      if (clickedPiece && clickedPiece.color === puzzle.playerColor) {
        const moves = game.moves({ square, verbose: true });
        setPlayingSelectedSq(square);
        setPlayingLegalMoves(moves.map(m => m.to));
        setFeedback(null);
        return;
      }

      // Second click: check legality first, then correctness
      const piece = game.get(playingSelectedSq);
      if (!piece) return;

      // ── Illegal move: target not reachable — no penalty ──
      if (!playingLegalMoves.includes(square)) {
        setWrongSquares({
          [playingSelectedSq]: { backgroundColor: 'rgba(220,60,60,0.35)' },
          [square]: { backgroundColor: 'rgba(220,60,60,0.35)' },
        });
        setTimeout(() => setWrongSquares({}), 700);
        setFeedback({ type: 'error', message: 'Illegal move — that square is not reachable from here.' });
        setTimeout(() => setFeedback(null), 2000);
        // Keep selection so user can try another target
        return;
      }

      const expectedUCI = puzzle.moves[moveIndex];
      const promoPiece = 'q'; // default queen promotion for click-click
      const isCorrect = movesMatch(playingSelectedSq, square, promoPiece, expectedUCI);

      // ── Wrong (but legal) move — penalize and prompt ──
      if (!isCorrect) {
        setWrongSquares({
          [playingSelectedSq]: { backgroundColor: 'rgba(220,60,60,0.55)' },
          [square]: { backgroundColor: 'rgba(220,60,60,0.55)' },
        });
        setTimeout(() => setWrongSquares({}), 700);
        const newWrong = wrongCount + 1;
        setWrongCount(newWrong);
        setWrongAttempts(prev => [...prev, { from: playingSelectedSq, to: square, at: moveIndex }]);
        setShowHint(newWrong >= 1);
        setShowWrongPrompt(true);
        setFeedback({ type: 'error', message: 'Wrong move — that\'s not the best one.' });
        setPlayingSelectedSq(null);
        setPlayingLegalMoves([]);
        return;
      }

      // ── Correct move ──────────────────────────────────────────────────────
      executionPassedRef.current = true;
      setShowHint(false);
      setShowWrongPrompt(false);
      setPlayingSelectedSq(null);
      setPlayingLegalMoves([]);
      const gameCopy = new Chess(game.fen());
      applyUCI(gameCopy, expectedUCI);
      setGame(gameCopy);

      const { from, to } = parseUCI(expectedUCI);
      setCorrectSquares({
        [from]: { backgroundColor: 'rgba(129,182,76,0.45)' },
        [to]:   { backgroundColor: 'rgba(129,182,76,0.45)' },
      });
      setTimeout(() => setCorrectSquares({}), 600);

      const nextIdx = moveIndex + 1;
      if (nextIdx >= puzzle.moves.length) {
        setStep(STEPS.SUCCESS);
        setFeedback({ type: 'success', message: puzzle.explanation || 'Excellent find!' });
        completeWithCCT(true, wrongCount);
        return;
      }

      setFeedback({ type: 'info', message: 'Correct! Opponent is thinking…' });
      setMoveIndex(nextIdx);

      setTimeout(() => {
        const opUCI = puzzle.moves[nextIdx];
        const g2 = new Chess(gameCopy.fen());
        if (!applyUCI(g2, opUCI)) {
          setStep(STEPS.SUCCESS);
          setFeedback({ type: 'success', message: puzzle.explanation || 'Puzzle complete!' });
          completeWithCCT(true, wrongCount);
          return;
        }
        setGame(g2);

        const nextPlayerIdx = nextIdx + 1;
        setMoveIndex(nextPlayerIdx);

        if (nextPlayerIdx >= puzzle.moves.length) {
          setStep(STEPS.SUCCESS);
          setFeedback({ type: 'success', message: puzzle.explanation || 'Excellent find!' });
          completeWithCCT(true, wrongCount);
        } else {
          setFeedback({ type: 'info', message: 'Keep going — find the next best move!' });
        }
      }, 700);
      return;
    }

    // ── CCT MODE ───────────────────────────────────────────────────────────
    if (step !== STEPS.CCT_MY_TURN && step !== STEPS.CCT_OPPONENT) return;
    if (cctRevealed) return; // locked after reveal

    const cctColor = step === STEPS.CCT_MY_TURN
      ? puzzle.playerColor
      : (puzzle.playerColor === 'w' ? 'b' : 'w');

    // ── First click: select a piece ─────────────────────────────────────────
    if (!selectedSq) {
      const piece = game.get(square);
      if (!piece) return;
      if (piece.color !== cctColor) {
        setCctFeedback({ type: 'error', message: 'Select your own piece.' });
        return;
      }
      setSelectedSq(square);
      setLegalTargets(getLegalTargets(game.fen(), square, cctColor));
      setCctFeedback(null);
      return;
    }

    // ── Deselect by clicking the same square ────────────────────────────────
    if (square === selectedSq) {
      setSelectedSq(null);
      setLegalTargets([]);
      return;
    }

    // ── Second click: validate and add entry ────────────────────────────────
    let vResult = validateCCTEntry(game.fen(), selectedSq, square, cctColor);

    // validateCCTEntry handles checks and captures (exact).
    // For quiet moves: use classifyThreatAttempt for exchange-based validation + rich feedback.
    if (!vResult.valid && vResult.actualType === 'none') {
      const cls = classifyThreatAttempt(game.fen(), selectedSq, square, cctColor);
      if (cls.isForcing) {
        vResult = {
          valid: true,
          actualType: 'threat',
          qualifies: ['threat'],
          threatens: cls.threatens,
          isFork: cls.isFork,
          feedback: null,
          successMessage: cls.message,
        };
      } else {
        vResult = {
          valid: false,
          actualType: 'none',
          qualifies: [],
          feedback: cls.message,
        };
      }
    }

    const { valid, actualType, feedback: vFeedback } = vResult;

    if (!valid) {
      setCctFeedback({ type: 'error', message: vFeedback });
      setWrongSquares({
        [selectedSq]: { backgroundColor: 'rgba(220,60,60,0.35)' },
        [square]:     { backgroundColor: 'rgba(220,60,60,0.35)' },
      });
      setTimeout(() => setWrongSquares({}), 600);
      setSelectedSq(null);
      setLegalTargets([]);
      return;
    }

    // A move can qualify for multiple types (e.g. Qxg7+ is both check AND capture).
    // Auto-add entries for ALL qualifying types in one click — no mode-switching needed.
    const qualifies = vResult.qualifies || [actualType];

    const newEntries = qualifies
      .filter(type => !cctEntries.some(e => e.from === selectedSq && e.to === square && e.type === type))
      .map((type, i) => ({
        from: selectedSq,
        to: square,
        type,
        id: Date.now() + i,
        ...(vResult.threatens ? { threatens: vResult.threatens } : {}),
      }));

    if (newEntries.length === 0) {
      setCctFeedback({
        type: 'info',
        message: `${selectedSq}→${square} already fully marked (${qualifies.join(' + ')}).`,
      });
      setSelectedSq(null);
      setLegalTargets([]);
      return;
    }

    setCctEntries(prev => [...prev, ...newEntries]);

    // Feedback
    const addedLabel = newEntries.map(e => e.type).join(' + ');
    if (qualifies.includes('threat') && vResult.successMessage) {
      setCctFeedback({ type: 'success', message: vResult.successMessage });
    } else if (newEntries.length > 1) {
      setCctFeedback({
        type: 'success',
        message: `${selectedSq}→${square} qualifies as ${addedLabel} — both recorded in one click!`,
      });
    } else {
      setCctFeedback(null);
    }

    setSelectedSq(null);
    setLegalTargets([]);
  }, [step, selectedSq, cctMode, cctEntries, cctRevealed, game, puzzle, playingSelectedSq, playingLegalMoves, moveIndex, wrongCount, onComplete]);

  // ── CCT "I'm Done" — record found counts for scoring ─────────────────────────
  const handleCCTDone = useCallback(() => {
    // Compute score inline (derived cctScore is null until cctRevealed is set)
    const data = computedCCTs
      ? (step === STEPS.CCT_MY_TURN ? computedCCTs.my : computedCCTs.opponent)
      : { checks: [], captures: [], threats: [] };
    const allFlat = [
      ...data.checks.map(c => ({ ...c, type: 'check' })),
      ...data.captures.map(c => ({ ...c, type: 'capture' })),
      ...data.threats.map(c => ({ ...c, type: 'threat' })),
    ];
    const found = cctEntries.filter(e => allFlat.some(c => e.from === c.from && e.to === c.to && e.type === c.type)).length;
    const total = allFlat.length;

    if (step === STEPS.CCT_MY_TURN) {
      cctResultRef.current.myFound = found;
      cctResultRef.current.myTotal = total;
    } else {
      cctResultRef.current.oppFound = found;
      cctResultRef.current.oppTotal = total;
    }
    setCctRevealed(true);
    setSelectedSq(null);
    setLegalTargets([]);
    setCctFeedback(null);
  }, [step, computedCCTs, cctEntries]);

  // ── CCT advance to next step ────────────────────────────────────────────────
  const handleCCTNext = useCallback(() => {
    setCctRevealed(false);
    setCctEntries([]);
    setSelectedSq(null);
    setLegalTargets([]);
    setCctFeedback(null);
    setCctMode('check');

    if (step === STEPS.CCT_MY_TURN) {
      setStep(STEPS.CCT_OPPONENT);
    } else if (executionPassedRef.current) {
      // Puzzle was already solved — skip execution, go straight to final evaluation
      setStep(STEPS.SUCCESS);
      setFeedback({ type: 'success', message: puzzle.explanation || 'Excellent find!' });
      completeWithCCT(true, 0);
    } else {
      setStep(STEPS.PLAYING);
    }
  }, [step, puzzle, completeWithCCT]);

  // ── Piece drop handler ──────────────────────────────────────────────────────
  const handlePieceDrop = useCallback(
    (sourceSquare, targetSquare, piece) => {
      if (step !== STEPS.PLAYING) return false;

      const promoPiece  = piece ? piece[1]?.toLowerCase() : 'q';

      // ── Illegal drop: chess.js rejects it — no penalty, piece snaps back ──
      const testGame = new Chess(game.fen());
      const testMove = testGame.move({ from: sourceSquare, to: targetSquare, promotion: promoPiece || 'q' });
      if (!testMove) {
        setFeedback({ type: 'error', message: 'Illegal move.' });
        setTimeout(() => setFeedback(null), 2000);
        return false;
      }

      const expectedUCI = puzzle.moves[moveIndex];
      const isCorrect   = movesMatch(sourceSquare, targetSquare, promoPiece, expectedUCI);

      // ── Wrong (but legal) drop — penalize and prompt ──
      if (!isCorrect) {
        setWrongSquares({
          [sourceSquare]: { backgroundColor: 'rgba(220,60,60,0.55)' },
          [targetSquare]: { backgroundColor: 'rgba(220,60,60,0.55)' },
        });
        setTimeout(() => setWrongSquares({}), 700);
        const newWrong = wrongCount + 1;
        setWrongCount(newWrong);
        setWrongAttempts(prev => [...prev, { from: sourceSquare, to: targetSquare, at: moveIndex }]);
        setShowHint(newWrong >= 1);
        setShowWrongPrompt(true);
        setFeedback({ type: 'error', message: 'Wrong move — that\'s not the best one.' });
        return false;
      }

      // ── Correct move ──────────────────────────────────────────────────────
      executionPassedRef.current = true;
      setShowHint(false);
      setShowWrongPrompt(false);
      const gameCopy = new Chess(game.fen());
      applyUCI(gameCopy, expectedUCI);
      setGame(gameCopy);

      const { from, to } = parseUCI(expectedUCI);
      setCorrectSquares({
        [from]: { backgroundColor: 'rgba(129,182,76,0.45)' },
        [to]:   { backgroundColor: 'rgba(129,182,76,0.45)' },
      });
      setTimeout(() => setCorrectSquares({}), 600);

      const nextIdx = moveIndex + 1;
      if (nextIdx >= puzzle.moves.length) {
        setStep(STEPS.SUCCESS);
        setFeedback({ type: 'success', message: puzzle.explanation || 'Excellent find!' });
        completeWithCCT(true, wrongCount);
        return true;
      }

      setFeedback({ type: 'info', message: 'Correct! Opponent is thinking…' });
      setMoveIndex(nextIdx);

      setTimeout(() => {
        const opUCI = puzzle.moves[nextIdx];
        const g2 = new Chess(gameCopy.fen());
        if (!applyUCI(g2, opUCI)) {
          setStep(STEPS.SUCCESS);
          setFeedback({ type: 'success', message: puzzle.explanation || 'Puzzle complete!' });
          completeWithCCT(true, wrongCount);
          return;
        }
        setGame(g2);

        const nextPlayerIdx = nextIdx + 1;
        setMoveIndex(nextPlayerIdx);

        if (nextPlayerIdx >= puzzle.moves.length) {
          setStep(STEPS.SUCCESS);
          setFeedback({ type: 'success', message: puzzle.explanation || 'Excellent find!' });
          completeWithCCT(true, wrongCount);
        } else {
          setFeedback({ type: 'info', message: 'Keep going — find the next best move!' });
        }
      }, 700);

      return true;
    },
    [step, game, moveIndex, puzzle, wrongCount, onComplete]
  );

  // ── Solution view: enter, exit, navigate ────────────────────────────────────

  // Compute FEN for any position in the solution sequence
  const solutionBoardFen = React.useMemo(() => {
    if (!solutionViewMode) return null;
    const g = new Chess(puzzle.fen);
    for (let i = 0; i < solutionViewPos; i++) {
      applyUCI(g, puzzle.moves[i]);
    }
    return g.fen();
  }, [solutionViewMode, solutionViewPos, puzzle]);

  // Precompute SAN labels for each solution move (for the move list)
  const solutionSAN = React.useMemo(() => {
    const labels = [];
    const g = new Chess(puzzle.fen);
    for (const uci of puzzle.moves) {
      const { from, to, promotion } = parseUCI(uci);
      try {
        const result = g.move({ from, to, promotion: promotion || 'q' });
        labels.push(result ? result.san : `${from}→${to}`);
      } catch {
        labels.push(`${from}→${to}`);
      }
    }
    return labels;
  }, [puzzle]);

  const enterSolutionView = useCallback(() => {
    // From CCT: skip analysis and go straight to PLAYING (interactive board)
    if (step === STEPS.CCT_MY_TURN || step === STEPS.CCT_OPPONENT) {
      setStep(STEPS.PLAYING);
      setMoveIndex(0);
      return;
    }
    // From PLAYING: penalise once and enter read-only solution navigator
    if (!solutionRevealedRef.current) {
      solutionRevealedRef.current = true;
      completeWithCCT(false, wrongCount, true);
    }
    setSolutionViewMode(true);
    setSolutionViewPos(0);
  }, [step, wrongCount, completeWithCCT]);

  const exitSolutionView = useCallback(() => {
    setSolutionViewMode(false);
  }, []);

  const stepSolutionTo = useCallback((pos) => {
    setSolutionViewPos(Math.max(0, Math.min(puzzle.moves.length, pos)));
  }, [puzzle.moves.length]);

  // Keyboard ←/→/Home/End navigation while solution view is open
  useEffect(() => {
    if (!solutionViewMode) return;
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  setSolutionViewPos(p => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setSolutionViewPos(p => Math.min(puzzle.moves.length, p + 1));
      else if (e.key === 'Home') setSolutionViewPos(0);
      else if (e.key === 'End')  setSolutionViewPos(puzzle.moves.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [solutionViewMode, puzzle.moves.length]);

  // ── Retry ───────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setGame(new Chess(puzzle.fen));
    setStep(STEPS.PLAYING);
    setMoveIndex(0);
    setFeedback(null);
    setWrongCount(0);
    setWrongAttempts([]);
    setWrongSquares({});
    setCorrectSquares({});
    setShowHint(false);
    setSolutionViewMode(false);
    setSolutionViewPos(0);
    setPlayingSelectedSq(null);
    setPlayingLegalMoves([]);
    setShowWrongPrompt(false);
    // Keep solutionRevealedRef.current — penalty was already recorded
  }, [puzzle]);

  // ── Retry with CCT — reset back to CCT analysis phase ──
  const handleRetryWithCCT = useCallback(() => {
    setGame(new Chess(puzzle.fen));
    setStep(fastMode ? STEPS.PLAYING : STEPS.CCT_MY_TURN);
    setMoveIndex(0);
    setFeedback(null);
    setWrongCount(0);
    setWrongAttempts([]);
    setWrongSquares({});
    setCorrectSquares({});
    setShowHint(false);
    setSolutionViewMode(false);
    setSolutionViewPos(0);
    setPlayingSelectedSq(null);
    setPlayingLegalMoves([]);
    setShowWrongPrompt(false);
    // Reset CCT state
    setCctEntries([]);
    setCctRevealed(false);
    setSelectedSq(null);
    setLegalTargets([]);
    setCctFeedback(null);
    setCctMode('check');
    cctResultRef.current = { myFound: 0, myTotal: 0, oppFound: 0, oppTotal: 0 };
    // Keep executionPassedRef — puzzle was already solved
    solutionRevealedRef.current = false;
  }, [puzzle, fastMode]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isCCTStep       = step === STEPS.CCT_MY_TURN || step === STEPS.CCT_OPPONENT;
  const arePiecesDraggable = step === STEPS.PLAYING && !solutionViewMode;

  // Threshold gate: user must find ≥CCT_THRESHOLD of total CCTs (my + opp) to unlock Solve
  const cctTotals = computedCCTs
    ? {
        myTotal:  computedCCTs.my.checks.length  + computedCCTs.my.captures.length  + computedCCTs.my.threats.length,
        oppTotal: computedCCTs.opponent.checks.length + computedCCTs.opponent.captures.length + computedCCTs.opponent.threats.length,
      }
    : { myTotal: 0, oppTotal: 0 };
  const cctGrandTotal = cctTotals.myTotal + cctTotals.oppTotal;
  const cctGrandFound = cctResultRef.current.myFound + cctResultRef.current.oppFound;
  const cctMeetsThreshold = cctGrandTotal === 0 || (cctGrandFound / cctGrandTotal) >= CCT_THRESHOLD;

  // Hint arrows for solving phase
  const hintArrows = showHint && step === STEPS.PLAYING && moveIndex < puzzle.moves.length
    ? hintArrow(puzzle.moves[moveIndex])
    : [];

  // CCT-derived data
  const cctColor = step === STEPS.CCT_MY_TURN
    ? puzzle.playerColor
    : (puzzle.playerColor === 'w' ? 'b' : 'w');

  const currentComputedCCTs = computedCCTs
    ? (step === STEPS.CCT_MY_TURN ? computedCCTs.my : computedCCTs.opponent)
    : { checks: [], captures: [], threats: [] };

  const allComputedFlat = [
    ...currentComputedCCTs.checks.map(c => ({ ...c, type: 'check' })),
    ...currentComputedCCTs.captures.map(c => ({ ...c, type: 'capture' })),
    ...currentComputedCCTs.threats.map(c => ({ ...c, type: 'threat' })),
  ];

  // Matching: from+to+type must all agree (a checking-capture counts separately per type)
  const matchesCCT = (entry, computed) => entry.from === computed.from && entry.to === computed.to && entry.type === computed.type;

  const missedCCTs = cctRevealed
    ? allComputedFlat.filter(c => !cctEntries.some(e => matchesCCT(e, c)))
    : [];

  const foundCount = cctRevealed
    ? cctEntries.filter(e => allComputedFlat.some(c => matchesCCT(e, c))).length
    : cctEntries.length;

  const cctScore = cctRevealed ? {
    found:    foundCount,
    total:    allComputedFlat.length,
    // Per-type: user entry counts if type matches AND from+to is in that type's computed list
    checks:   { found: cctEntries.filter(e => e.type === 'check'   && currentComputedCCTs.checks.some(c   => c.from === e.from && c.to === e.to)).length, total: currentComputedCCTs.checks.length },
    captures: { found: cctEntries.filter(e => e.type === 'capture' && currentComputedCCTs.captures.some(c => c.from === e.from && c.to === e.to)).length, total: currentComputedCCTs.captures.length },
    threats:  { found: cctEntries.filter(e => e.type === 'threat'  && currentComputedCCTs.threats.some(c  => c.from === e.from && c.to === e.to)).length,  total: currentComputedCCTs.threats.length },
  } : null;

  // CCT arrows (user-found = bright, missed = dim)
  // Deduplicate: if same from-to has multiple types, keep highest priority (check > capture > threat)
  const cctArrows = (isCCTStep && !solutionViewMode) ? (() => {
    const arrowMap = new Map();

    // Helper to add arrow with priority deduplication
    const addArrow = (from, to, color) => {
      const key = `${from}-${to}`;
      // Priority: check (red) > capture (orange) > threat (green)
      const currentColor = arrowMap.get(key);
      if (!currentColor || color === '#c93a3a' || // check is highest
          (color === '#c9882a' && currentColor !== '#c93a3a')) { // capture > threat
        arrowMap.set(key, [from, to, color]);
      }
    };

    cctEntries.forEach(e => addArrow(e.from, e.to, CCT_COLORS[e.type] || '#81b64c'));
    missedCCTs.forEach(e => addArrow(e.from, e.to, CCT_COLORS_DIM[e.type] || 'rgba(255,255,255,0.2)'));

    return Array.from(arrowMap.values());
  })() : [];

  // CCT square styles (selected piece + legal target dots)
  const cctSquareStyles = {};
  if (isCCTStep && !cctRevealed && !solutionViewMode) {
    if (selectedSq) {
      cctSquareStyles[selectedSq] = { backgroundColor: 'rgba(255,221,0,0.45)', borderRadius: '4px' };
    }
    legalTargets.forEach(sq => {
      const occupied = !!game.get(sq);
      cctSquareStyles[sq] = occupied
        ? { backgroundColor: 'rgba(255,221,0,0.22)', borderRadius: '4px', outline: '2px solid rgba(255,221,0,0.5)' }
        : { background: 'radial-gradient(circle, rgba(255,221,0,0.45) 30%, transparent 31%)', borderRadius: '50%' };
    });
  }

  // PLAYING mode square styles (selected piece + legal move indicators)
  const playingSquareStyles = {};
  if (step === STEPS.PLAYING && playingSelectedSq) {
    playingSquareStyles[playingSelectedSq] = { backgroundColor: 'rgba(129,182,76,0.5)', borderRadius: '4px' };
    playingLegalMoves.forEach(sq => {
      const occupied = !!game.get(sq);
      playingSquareStyles[sq] = occupied
        ? { backgroundColor: 'rgba(129,182,76,0.25)', borderRadius: '4px', outline: '2px solid rgba(129,182,76,0.6)' }
        : { background: 'radial-gradient(circle, rgba(129,182,76,0.5) 30%, transparent 31%)', borderRadius: '50%' };
    });
  }

  const allArrows    = [...hintArrows, ...cctArrows];
  const allSqStyles  = { ...correctSquares, ...wrongSquares, ...cctSquareStyles, ...playingSquareStyles };

  // ─── INTRO MODAL ───────────────────────────────────────────────────────────
  if (step === STEPS.INTRO_MODAL) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#262421' }}>
        <div
          className="max-w-lg w-full rounded-3xl p-8"
          style={{ backgroundColor: '#312e2b', border: '2px solid #81b64c', boxShadow: '0 0 40px #81b64c22' }}
        >
          <div className="text-4xl mb-4 text-center">🧠</div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">How to Use the Tactical Trainer</h2>
          <p className="text-center text-sm mb-6" style={{ color: '#8b8987' }}>
            This is not a puzzle app — it is a <strong style={{ color: '#bababa' }}>thinking trainer</strong>.
          </p>

          <div className="space-y-4 mb-8">
            {[
              {
                icon: '1️⃣',
                title: 'Find YOUR Checks, Captures & Threats',
                body: 'Before moving, click your pieces on the board to identify every check, capture, and threat you have. Two clicks: piece → target.',
              },
              {
                icon: '2️⃣',
                title: 'Find OPPONENT\'s Checks, Captures & Threats',
                body: 'Now see the board from their side. What are they threatening? This shapes which of your candidates is actually best.',
              },
              {
                icon: '3️⃣',
                title: 'Make Your Move',
                body: 'Drag the piece to the target square. Wrong moves flash red. After 1 wrong try, a hint arrow appears.',
              },
              {
                icon: '4️⃣',
                title: 'See the Solution',
                body: 'If stuck, hit Show Solution — every move animates so you understand the idea, not just the answer.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: '#1a1916' }}>
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <div className="font-bold text-white text-sm mb-1">{title}</div>
                  <div className="text-sm" style={{ color: '#bababa' }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={dismissIntro}
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-colors"
            style={{ backgroundColor: '#81b64c' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#a3d160')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#81b64c')}
          >
            Let's Train! →
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN PUZZLE VIEW ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#262421' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: '#8b8987' }}
            onMouseEnter={e => (e.target.style.color = '#bababa')}
            onMouseLeave={e => (e.target.style.color = '#8b8987')}
          >
            ← {stageTitle}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPuzzleList(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: '#312e2b',
                color: '#8b8987',
                border: '1px solid #4a4744',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#bababa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8b8987')}
            >
              📋 Puzzle List
            </button>
            <span className="text-sm" style={{ color: '#8b8987' }}>
              {puzzleNumber}/{totalPuzzles}
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: '#1a1916', color: '#4a4744', border: '1px solid #3a3734' }}
              title="Puzzle ID — use this to refer to a specific puzzle"
            >
              {puzzle.id}
            </span>
            {stageVideo && (
              <button
                onClick={() => setShowVideo(v => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: showVideo ? '#5b8dd922' : '#312e2b',
                  color: showVideo ? '#5b8dd9' : '#8b8987',
                  border: `1px solid ${showVideo ? '#5b8dd9' : '#4a4744'}`,
                }}
              >
                📹 {showVideo ? 'Hide Video' : 'Stage Guide'}
              </button>
            )}
            <button
              onClick={toggleFastMode}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: fastMode ? '#81b64c22' : '#312e2b',
                color: fastMode ? '#81b64c' : '#8b8987',
                border: `1px solid ${fastMode ? '#81b64c' : '#4a4744'}`,
              }}
            >
              {fastMode ? '⚡ Fast' : '🧠 Guided'}
            </button>
          </div>
        </div>

        {/* ── Stage video embed ── */}
        {showVideo && stageVideo && (
          <div className="mb-5 rounded-2xl overflow-hidden" style={{ border: '1px solid #4a4744' }}>
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: '#1a1916', color: '#5b8dd9' }}>
              📹 {stageVideo.title}
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${stageVideo.youtubeId}?rel=0&modestbranding=1`}
                title={stageVideo.title}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* ── Progress bar ── */}
        <div className="mb-5">
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#312e2b' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round((puzzleNumber / totalPuzzles) * 100)}%`, backgroundColor: '#81b64c' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Left: Board ── */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl p-5" style={{ backgroundColor: '#312e2b', border: '1px solid #4a4744' }}>

              {/* Board header */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2"
                    style={{
                      backgroundColor: puzzle.playerColor === 'w' ? '#ffffff' : '#1a1916',
                      borderColor: puzzle.playerColor === 'w' ? '#ccc' : '#8b8987',
                    }}
                  />
                  <span className="font-semibold text-white">
                    {puzzle.playerColor === 'w' ? 'White' : 'Black'} to move
                  </span>
                  {isCCTStep && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: step === STEPS.CCT_MY_TURN ? '#81b64c22' : '#5b8dd922',
                        color: step === STEPS.CCT_MY_TURN ? '#81b64c' : '#5b8dd9',
                      }}
                    >
                      {step === STEPS.CCT_MY_TURN ? 'Analysis: You' : 'Analysis: Opponent'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {solutionViewMode && (
                    <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: '#5b8dd922', color: '#5b8dd9' }}>
                      Solution {solutionViewPos}/{puzzle.moves.length}
                    </span>
                  )}
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: puzzle.difficulty === 'easy' ? '#81b64c22' : puzzle.difficulty === 'very hard' ? '#c93a3a22' : puzzle.difficulty === 'hard' ? '#c9882a22' : '#81b64c22',
                      color: puzzle.difficulty === 'easy' ? '#81b64c' : puzzle.difficulty === 'very hard' ? '#c93a3a' : puzzle.difficulty === 'hard' ? '#c9882a' : '#81b64c',
                    }}
                  >
                    {puzzle.difficulty}
                  </span>
                </div>
              </div>

              <Chessboard
                position={solutionViewMode ? solutionBoardFen : game.fen()}
                onPieceDrop={handlePieceDrop}
                onSquareClick={handleSquareClick}
                boardOrientation={puzzle.playerColor === 'w' ? 'white' : 'black'}
                arePiecesDraggable={arePiecesDraggable}
                customSquareStyles={allSqStyles}
                customArrows={allArrows}
                customDarkSquareStyle={{ backgroundColor: '#779556' }}
                customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
                customBoardStyle={{ borderRadius: '10px', overflow: 'hidden' }}
                animationDuration={300}
              />

              {/* Themes */}
              <div className="mt-4 px-1 flex flex-wrap gap-2">
                {puzzle.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium px-2.5 py-1 rounded-md"
                    style={{ backgroundColor: '#4a4744', color: '#bababa' }}
                  >
                    {theme.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                ))}
              </div>

              {/* Move list: solution view shows solution moves; playing/success shows attempted moves */}
              {(step === STEPS.PLAYING || step === STEPS.SUCCESS) && (
                <div className="mt-4 px-1">
                  <div className="rounded-xl p-3" style={{ backgroundColor: '#262421', border: '1px solid #4a4744' }}>
                    {solutionViewMode ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5b8dd9' }}>
                            Solution Moves
                          </span>
                          <span className="text-xs font-mono" style={{ color: '#5b8dd9' }}>
                            {solutionViewPos}/{puzzle.moves.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {solutionSAN.map((san, i) => {
                            const isPlayerMove = i % 2 === 0;
                            const isPast = i < solutionViewPos;
                            const isCurrent = i === solutionViewPos - 1;
                            return (
                              <button
                                key={i}
                                onClick={() => stepSolutionTo(i + 1)}
                                className="text-xs font-mono px-2 py-1 rounded-md transition-all"
                                style={{
                                  backgroundColor: isCurrent
                                    ? (isPlayerMove ? '#81b64c55' : '#5b8dd955')
                                    : isPast ? (isPlayerMove ? '#81b64c22' : '#5b8dd922') : '#3a3734',
                                  color: isPast || isCurrent
                                    ? (isPlayerMove ? '#81b64c' : '#5b8dd9')
                                    : '#5b5754',
                                  border: `1px solid ${isCurrent ? (isPlayerMove ? '#81b64c' : '#5b8dd9') : 'transparent'}`,
                                  fontWeight: isCurrent ? 'bold' : 'normal',
                                }}
                              >
                                {Math.floor(i / 2) + 1}{isPlayerMove ? '.' : '…'} {san}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8b8987' }}>
                            Move History
                          </span>
                          <span className="text-xs font-mono" style={{ color: '#5b8dd9' }}>
                            {moveIndex}/{puzzle.moves.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {moveIndex === 0 ? (
                            <span className="text-xs italic" style={{ color: '#5b5754' }}>No moves yet — make the first move!</span>
                          ) : (
                            puzzle.moves.slice(0, moveIndex).map((move, i) => {
                              const { from, to, promotion } = parseUCI(move);
                              const isPlayerMove = i % 2 === 0;
                              return (
                                <span
                                  key={i}
                                  className="text-xs font-mono px-2 py-1 rounded-md"
                                  style={{
                                    backgroundColor: isPlayerMove ? (wrongAttempts.some(a => a.at === i) ? '#c93a3a18' : '#81b64c22') : '#5b8dd922',
                                    color: isPlayerMove ? (wrongAttempts.some(a => a.at === i) ? '#f87171' : '#81b64c') : '#5b8dd9',
                                    border: `1px solid ${isPlayerMove ? (wrongAttempts.some(a => a.at === i) ? '#c93a3a44' : '#81b64c44') : '#5b8dd944'}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  {Math.floor(i / 2) + 1}{isPlayerMove ? '.' : '…'} {from}→{to}{promotion ? promotion.toUpperCase() : ''}
                                  {isPlayerMove && (
                                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                                      {wrongAttempts.some(a => a.at === i) ? '✗' : '✓'}
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Thinking Panel ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            <div className="rounded-3xl p-6 flex-1" style={{ backgroundColor: '#312e2b', border: '1px solid #4a4744' }}>

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {isCCTStep ? '🔍 CCT Analysis' : fastMode ? '⚡ Solve the Puzzle' : '🧠 Guided Thinking'}
                </h2>
                {wrongCount > 0 && step === STEPS.PLAYING && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                    style={{ backgroundColor: '#c9882a22', color: '#c9882a' }}>
                    {wrongCount} wrong {wrongCount === 1 ? 'try' : 'tries'}
                  </span>
                )}
              </div>

              {/* ─── Solution Navigator — available at ANY step ────────────── */}
              {solutionViewMode && (
                <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#1a1916', border: '1px solid #5b8dd944' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5b8dd9' }}>
                      📖 Solution Navigator
                    </span>
                    <span className="text-xs font-mono" style={{ color: '#5b8dd9' }}>
                      {solutionViewPos}/{puzzle.moves.length}
                    </span>
                  </div>

                  {/* Move label */}
                  {solutionViewPos > 0 ? (
                    <div className="text-sm font-semibold text-center py-1 rounded-lg"
                      style={{
                        backgroundColor: (solutionViewPos - 1) % 2 === 0 ? '#81b64c22' : '#5b8dd922',
                        color: (solutionViewPos - 1) % 2 === 0 ? '#81b64c' : '#5b8dd9',
                      }}>
                      {(solutionViewPos - 1) % 2 === 0 ? '▶ Your move:' : '◀ Opponent:'} {solutionSAN[solutionViewPos - 1]}
                    </div>
                  ) : (
                    <div className="text-xs text-center py-1" style={{ color: '#5b5754' }}>
                      Starting position — press ▶ to step through
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#3a3734' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((solutionViewPos / puzzle.moves.length) * 100)}%`, backgroundColor: '#5b8dd9' }} />
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-1">
                    {[
                      { label: '|◀', action: () => stepSolutionTo(0),                   disabled: solutionViewPos <= 0 },
                      { label: '◀',  action: () => stepSolutionTo(solutionViewPos - 1), disabled: solutionViewPos <= 0 },
                      { label: '▶',  action: () => stepSolutionTo(solutionViewPos + 1), disabled: solutionViewPos >= puzzle.moves.length },
                      { label: '▶|', action: () => stepSolutionTo(puzzle.moves.length), disabled: solutionViewPos >= puzzle.moves.length },
                    ].map(({ label, action, disabled }) => (
                      <button key={label} onClick={action} disabled={disabled}
                        className="flex-1 py-2 rounded-lg font-mono font-bold text-sm transition-colors"
                        style={{
                          backgroundColor: disabled ? '#2a2724' : '#3a3734',
                          color: disabled ? '#4a4744' : '#bababa',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => !disabled && (e.currentTarget.style.backgroundColor = '#4a4744')}
                        onMouseLeave={e => !disabled && (e.currentTarget.style.backgroundColor = '#3a3734')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-center" style={{ color: '#5b5754' }}>← → keys also navigate</p>

                  {/* Exit solution view */}
                  <button onClick={exitSolutionView}
                    className="w-full py-2 rounded-xl text-xs font-bold transition-colors"
                    style={{ backgroundColor: '#3a3734', color: '#8b8987' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#3a3734')}
                  >
                    {isCCTStep ? '← Back to Analysis' : step === STEPS.PLAYING ? '← Back to Puzzle' : '← Back'}
                  </button>

                  {/* Retry / next — only while actively solving */}
                  {step === STEPS.PLAYING && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleRetry}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors"
                        style={{ backgroundColor: '#4a4744', color: '#bababa' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a5754')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
                      >
                        ↺ Try Again
                      </button>
                      {hasNext && (
                        <button onClick={onNext}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-colors"
                          style={{ backgroundColor: '#81b64c' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#a3d160')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#81b64c')}
                        >
                          Next →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─── CCT: MY TURN step ─────────────────────────────────────── */}
              {!solutionViewMode && step === STEPS.CCT_MY_TURN && !fastMode && (
                <>
                  <CCTPanel
                    title="What can YOU do?"
                    subtitle="Find your checks, captures &amp; threats"
                    stepLabel="Step 1 of 2"
                    stepColor="#81b64c"
                    cctMode={cctMode}
                    setCctMode={m => { setCctMode(m); setSelectedSq(null); setLegalTargets([]); }}
                    cctEntries={cctEntries}
                    setCctEntries={setCctEntries}
                    cctFeedback={cctFeedback}
                    cctRevealed={cctRevealed}
                    missedCCTs={missedCCTs}
                    cctScore={cctScore}
                    onDone={handleCCTDone}
                    onNext={handleCCTNext}
                    nextLabel="Check Opponent CCTs →"
                    nextColor="#81b64c"
                    thresholdMet={true}
                    foundCount={cctGrandFound}
                    totalCount={cctGrandTotal}
                    thresholdPct={CCT_THRESHOLD}
                  />
                  <button
                    onClick={enterSolutionView}
                    className="w-full mt-3 py-2 rounded-xl text-xs font-bold transition-colors"
                    style={{ backgroundColor: '#1a1916', color: '#5b5754', border: '1px solid #3a3734' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#5b8dd9'; e.currentTarget.style.borderColor = '#5b8dd944'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#5b5754'; e.currentTarget.style.borderColor = '#3a3734'; }}
                  >
                    📖 Peek at Solution (won't affect score)
                  </button>
                </>
              )}

              {/* ─── CCT: OPPONENT step ────────────────────────────────────── */}
              {!solutionViewMode && step === STEPS.CCT_OPPONENT && !fastMode && (
                <>
                  <CCTPanel
                    title="What can the OPPONENT do?"
                    subtitle="Find their checks, captures &amp; threats"
                    stepLabel="Step 2 of 2"
                    stepColor="#5b8dd9"
                    cctMode={cctMode}
                    setCctMode={m => { setCctMode(m); setSelectedSq(null); setLegalTargets([]); }}
                    cctEntries={cctEntries}
                    setCctEntries={setCctEntries}
                    cctFeedback={cctFeedback}
                    cctRevealed={cctRevealed}
                    missedCCTs={missedCCTs}
                    cctScore={cctScore}
                    onDone={handleCCTDone}
                    onNext={handleCCTNext}
                    onGoBack={() => setCctRevealed(false)}
                    nextLabel="Solve the Puzzle →"
                    nextColor="#5b8dd9"
                    thresholdMet={cctMeetsThreshold}
                    foundCount={cctGrandFound}
                    totalCount={cctGrandTotal}
                    thresholdPct={CCT_THRESHOLD}
                  />
                  <button
                    onClick={enterSolutionView}
                    className="w-full mt-3 py-2 rounded-xl text-xs font-bold transition-colors"
                    style={{ backgroundColor: '#1a1916', color: '#5b5754', border: '1px solid #3a3734' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#5b8dd9'; e.currentTarget.style.borderColor = '#5b8dd944'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#5b5754'; e.currentTarget.style.borderColor = '#3a3734'; }}
                  >
                    📖 Peek at Solution (won't affect score)
                  </button>
                </>
              )}

              {/* ─── PLAYING / SUCCESS ─────────────────────────────────────── */}
              {!solutionViewMode && [STEPS.PLAYING, STEPS.SUCCESS].includes(step) && (
                <div className="space-y-4">

                  {/* Wrong move prompt — ask user before penalising further */}
                  {step === STEPS.PLAYING && showWrongPrompt && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #c93a3a55' }}>
                      <div className="p-4" style={{ backgroundColor: '#c93a3a15' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">✗</span>
                          <span className="font-bold text-sm" style={{ color: '#f87171' }}>That's not the right move.</span>
                        </div>
                        {showHint && (
                          <p className="text-xs mb-3" style={{ color: '#8b8987' }}>
                            The hint arrow on the board shows which piece to move.
                          </p>
                        )}
                        <p className="text-xs mb-3" style={{ color: '#8b8987' }}>
                          Would you like to see the full solution?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowWrongPrompt(false)}
                            className="flex-1 py-2 rounded-lg font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#3a3734', color: '#bababa' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#3a3734')}
                          >
                            ↩ Try Again
                          </button>
                          <button
                            onClick={() => { setShowWrongPrompt(false); enterSolutionView(); }}
                            className="flex-1 py-2 rounded-lg font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#5b8dd922', color: '#5b8dd9', border: '1px solid #5b8dd944' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5b8dd933')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5b8dd922')}
                          >
                            📖 See Solution
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* "Your turn" prompt */}
                  {step === STEPS.PLAYING && !feedback && !showWrongPrompt && (
                    <div className="p-4 rounded-xl flex items-start gap-3"
                      style={{ backgroundColor: '#81b64c15', border: '1px solid #81b64c33', color: '#81b64c' }}>
                      <span className="text-lg">♟️</span>
                      <p className="font-medium text-sm">
                        Drag the piece to the target square. Wrong moves flash red.
                      </p>
                    </div>
                  )}

                  {/* Feedback message */}
                  {feedback && !showWrongPrompt && (
                    <div
                      className="p-4 rounded-xl flex items-start gap-3 transition-all"
                      style={{
                        backgroundColor: feedback.type === 'success' ? '#81b64c15' : feedback.type === 'error' ? '#c93a3a15' : '#5b8dd915',
                        border: `1px solid ${feedback.type === 'success' ? '#81b64c33' : feedback.type === 'error' ? '#c93a3a33' : '#5b8dd933'}`,
                        color: feedback.type === 'success' ? '#81b64c' : feedback.type === 'error' ? '#f87171' : '#93c5fd',
                      }}
                    >
                      <span className="text-lg flex-shrink-0">
                        {feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '✗' : 'ℹ'}
                      </span>
                      <p className="font-medium text-sm leading-relaxed">{feedback.message}</p>
                    </div>
                  )}

                  {/* Two-phase score breakdown or pending notice */}
                  {step === STEPS.SUCCESS && puzzleScore && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#1a1916', border: '1px solid #3a3734' }}>
                      {/* CCT not attempted — show pending notice */}
                      {!puzzleScore.cctAttempted ? (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8b8987' }}>
                              Puzzle Score
                            </span>
                            <span className="text-xl font-bold" style={{ color: '#c9882a' }}>
                              Pending
                            </span>
                          </div>

                          <div className="px-3 py-3 rounded-lg mb-3 text-sm text-center" style={{ backgroundColor: '#c9882a12', border: '1px solid #c9882a33', color: '#c9882a' }}>
                            CCT analysis was skipped. Complete the CCT phase to earn a score.
                          </div>

                          {/* CCT phase */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: '#c9882a' }}>🔍 CCT Analysis</span>
                              <span className="font-bold" style={{ color: '#6b7280' }}>Not Attempted</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#3a3734' }}>
                              <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: '#3a3734' }} />
                            </div>
                          </div>

                          {/* Execution phase — still show */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: '#5b8dd9' }}>♟ Execution</span>
                              <span className="font-bold" style={{ color: '#5b8dd9' }}>{puzzleScore.execScore}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#3a3734' }}>
                              <div className="h-full rounded-full" style={{ width: `${puzzleScore.execScore}%`, backgroundColor: '#5b8dd9' }} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8b8987' }}>
                              Puzzle Score
                            </span>
                            <span className="text-xl font-bold" style={{
                              color: puzzleScore.combined >= 80 ? '#81b64c' : puzzleScore.combined >= 50 ? '#c9882a' : '#c93a3a'
                            }}>
                              {puzzleScore.combined}<span className="text-xs font-normal" style={{ color: '#8b8987' }}>/100</span>
                            </span>
                          </div>

                          {/* CCT phase */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: '#c9882a' }}>🔍 CCT Analysis</span>
                              <span className="font-bold" style={{ color: '#c9882a' }}>{puzzleScore.cctScore}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#3a3734' }}>
                              <div className="h-full rounded-full" style={{ width: `${puzzleScore.cctScore}%`, backgroundColor: '#c9882a' }} />
                            </div>
                            <div className="flex justify-between text-xs mt-1" style={{ color: '#6b7280' }}>
                              <span>You: {puzzleScore.myFound}/{puzzleScore.myTotal}</span>
                              <span>Opp: {puzzleScore.oppFound}/{puzzleScore.oppTotal}</span>
                            </div>
                          </div>

                          {/* Execution phase */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: '#5b8dd9' }}>♟ Execution</span>
                              <span className="font-bold" style={{ color: '#5b8dd9' }}>{puzzleScore.execScore}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#3a3734' }}>
                              <div className="h-full rounded-full" style={{ width: `${puzzleScore.execScore}%`, backgroundColor: '#5b8dd9' }} />
                            </div>
                          </div>

                          {/* Execution analysis: why this score */}
                          <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: '#3a3734' }}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#5b8987' }}>
                              Why this score?
                            </p>
                            <div className="flex justify-between text-xs" style={{ color: '#8b8987' }}>
                              <span>Starting score</span>
                              <span className="font-mono" style={{ color: '#81b64c' }}>100</span>
                            </div>
                            {puzzleScore.solutionShown ? (
                              <div className="flex justify-between text-xs" style={{ color: '#8b8987' }}>
                                <span>Solution revealed</span>
                                <span className="font-mono" style={{ color: '#c93a3a' }}>→ 0</span>
                              </div>
                            ) : wrongAttempts.length > 0 ? (
                              wrongAttempts.map((a, i) => (
                                <div key={i} className="flex justify-between text-xs" style={{ color: '#8b8987' }}>
                                  <span>Wrong #{i + 1}: <span className="font-mono">{a.from}→{a.to}</span></span>
                                  <span className="font-mono" style={{ color: '#c93a3a' }}>
                                    {i === 0 ? '−25' : i === 1 ? '−25' : i === 2 ? '−25' : '−15'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex justify-between text-xs" style={{ color: '#8b8987' }}>
                                <span>No wrong attempts</span>
                                <span className="font-mono" style={{ color: '#81b64c' }}>perfect!</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Rating change */}
                  {step === STEPS.SUCCESS && ratingDelta && ratingDelta.value !== 0 && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-xl"
                      style={{ backgroundColor: '#81b64c15', color: '#81b64c' }}>
                      <span>📈</span>
                      <span>{ratingDelta.sign}{Math.abs(ratingDelta.value)} rating</span>
                    </div>
                  )}

                  {/* Hint / Show Solution — visible during PLAYING */}
                  {step === STEPS.PLAYING && (
                    <div className="flex flex-col gap-2">
                      {showHint ? (
                        <div className="flex-1 py-3 rounded-xl font-bold text-center text-sm"
                          style={{ backgroundColor: '#c9882a15', color: '#c9882a', border: '1px solid #c9882a33' }}>
                          ↑ Arrow on board shows the right piece
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowHint(true); setFeedback({ type: 'info', message: 'Hint: the arrow shows where to start.' }); }}
                          className="flex-1 py-3 rounded-xl font-bold transition-colors"
                          style={{ backgroundColor: '#c9882a22', color: '#c9882a', border: '1px solid #c9882a44' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#c9882a33')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#c9882a22')}
                        >
                          💡 Hint
                        </button>
                      )}
                      <button
                        onClick={enterSolutionView}
                        className="w-full py-3 rounded-xl font-bold transition-colors"
                        style={{ backgroundColor: '#5b8dd922', color: '#5b8dd9', border: '1px solid #5b8dd944' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5b8dd933')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5b8dd922')}
                      >
                        📖 View Solution (execution score → 0)
                      </button>
                    </div>
                  )}

                  {/* Success actions */}
                  {step === STEPS.SUCCESS && (
                    <div className="flex flex-col gap-2">
                      {/* CCT not attempted — must retry with CCT to complete */}
                      {puzzleScore && !puzzleScore.cctAttempted ? (
                        <>
                          <button
                            onClick={handleRetryWithCCT}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors"
                            style={{ backgroundColor: '#c9882a' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#d9992e')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#c9882a')}
                          >
                            🧠 Complete CCT Analysis
                          </button>
                          <button
                            onClick={enterSolutionView}
                            className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#5b8dd922', color: '#5b8dd9', border: '1px solid #5b8dd944' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5b8dd933')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5b8dd922')}
                          >
                            📖 Review Solution
                          </button>
                          <button onClick={onBack} className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#3a3734', color: '#8b8987', border: '1px solid #4a4744' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#3a3734')}>
                            ← Back to Stages
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={enterSolutionView}
                            className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#5b8dd922', color: '#5b8dd9', border: '1px solid #5b8dd944' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5b8dd933')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#5b8dd922')}
                          >
                            📖 Review Solution
                          </button>
                          <button
                            onClick={handleRetry}
                            className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors"
                            style={{ backgroundColor: '#3a3734', color: '#8b8987', border: '1px solid #4a4744' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#3a3734')}
                          >
                            ↺ Try Again (score already saved)
                          </button>
                          <div className="flex gap-2">
                            <button onClick={onBack} className="px-4 py-3 rounded-xl font-bold transition-colors"
                              style={{ backgroundColor: '#4a4744', color: '#bababa' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a5754')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4a4744')}>
                              Stages
                            </button>
                            {hasNext && (
                              <button onClick={onNext} className="flex-1 py-3 rounded-xl font-bold text-white transition-colors"
                                style={{ backgroundColor: '#81b64c' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#a3d160')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#81b64c')}>
                                Next Puzzle →
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Objective card */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#312e2b', border: '1px solid #4a4744' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#8b8987' }}>
                Objective
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#bababa' }}>
                {puzzle.explanation || `Find the best move for ${puzzle.playerColor === 'w' ? 'White' : 'Black'}.`}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Puzzle List Modal */}
      <PuzzleListModal
        isOpen={showPuzzleList}
        onClose={() => setShowPuzzleList(false)}
        puzzles={allStagePuzzles}
        currentPuzzleIndex={puzzleNumber - 1}
        completedPuzzleIds={completedPuzzleIds}
        onJumpToPuzzle={onJumpToPuzzle}
        puzzleScores={puzzleScores}
      />
    </div>
  );
}

// ─── CCT Panel (sub-component, inline to avoid extra file) ────────────────────

function CCTPanel({
  title, subtitle, stepLabel, stepColor,
  cctMode, setCctMode,
  cctEntries, setCctEntries,
  cctFeedback,
  cctRevealed,
  missedCCTs,
  cctScore,
  onDone, onNext, onGoBack,
  nextLabel, nextColor,
  thresholdMet = true,
  foundCount = 0,
  totalCount = 0,
  thresholdPct = 0.5,
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: stepColor }}>
          {stepLabel}
        </div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <p className="text-xs mt-1" style={{ color: '#8b8987' }}>
          {cctRevealed
            ? 'See what you found and what you missed.'
            : CCT_INSTRUCTIONS[cctMode]}
        </p>
      </div>

      {/* Mode toggle */}
      {!cctRevealed && (
        <div className="flex gap-2">
          {['check', 'capture', 'threat'].map(mode => (
            <button
              key={mode}
              onClick={() => setCctMode(mode)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize"
              style={{
                backgroundColor: cctMode === mode ? `${CCT_COLORS[mode]}22` : '#1a1916',
                color:           cctMode === mode ? CCT_COLORS[mode] : '#6b7280',
                border: `1px solid ${cctMode === mode ? CCT_COLORS[mode] : '#3a3734'}`,
              }}
            >
              {mode === 'check' ? '✚ Check' : mode === 'capture' ? '× Capture' : '→ Threat'}
            </button>
          ))}
        </div>
      )}

      {/* Inline feedback */}
      {cctFeedback && !cctRevealed && (
        <div
          className="px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: cctFeedback.type === 'error' ? '#c93a3a18' : cctFeedback.type === 'success' ? '#81b64c18' : '#5b8dd918',
            color:           cctFeedback.type === 'error' ? '#f87171'   : cctFeedback.type === 'success' ? '#81b64c'   : '#93c5fd',
            border: `1px solid ${cctFeedback.type === 'error' ? '#c93a3a33' : cctFeedback.type === 'success' ? '#81b64c33' : '#5b8dd933'}`,
          }}
        >
          {cctFeedback.message}
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {cctEntries.length === 0 && !cctRevealed && (
          <div className="text-xs text-center py-4" style={{ color: '#4a4744' }}>
            No CCTs marked yet
          </div>
        )}

        {cctEntries.map(entry => (
          <div key={entry.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#1a1916', borderLeft: `3px solid ${CCT_COLORS[entry.type]}` }}>
            <span className="font-mono" style={{ color: '#bababa' }}>
              {entry.from}→{entry.to}
              {entry.type === 'threat' && entry.threatens && (
                <span style={{ color: '#6b7280' }}> ⟶{entry.threatens}</span>
              )}
            </span>
            <span style={{ color: CCT_COLORS[entry.type] }}>{entry.type}</span>
            {!cctRevealed && (
              <button
                onClick={() => setCctEntries(prev => prev.filter(e => e.id !== entry.id))}
                className="ml-2 transition-colors text-xs"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
              >
                ✕
              </button>
            )}
            {cctRevealed && (
              <span className="ml-2 text-green-400 text-xs">✓</span>
            )}
          </div>
        ))}

        {/* Missed entries */}
        {cctRevealed && missedCCTs.map((entry, i) => (
          <div key={`missed-${i}`}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium opacity-60"
            style={{ backgroundColor: '#1a1916', borderLeft: '3px solid #4b5563' }}>
            <span className="font-mono" style={{ color: '#6b7280' }}>{entry.from}→{entry.to}</span>
            <span style={{ color: '#6b7280' }}>{entry.type}</span>
            <span className="ml-2 text-xs" style={{ color: '#6b7280' }}>missed</span>
          </div>
        ))}
      </div>

      {/* Score (after reveal) */}
      {cctRevealed && cctScore && (
        <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: '#1a1916', border: '1px solid #3a3734' }}>
          <div className="font-bold text-white text-sm mb-2">
            Found {cctScore.found}/{cctScore.total} CCTs
            {cctScore.found === cctScore.total && cctScore.total > 0 && (
              <span className="ml-2 text-green-400">🎯 Perfect!</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: '#8b8987' }}>
            <div>
              <span style={{ color: CCT_COLORS.check }}>✚ </span>
              {cctScore.checks.found}/{cctScore.checks.total}
            </div>
            <div>
              <span style={{ color: CCT_COLORS.capture }}>× </span>
              {cctScore.captures.found}/{cctScore.captures.total}
            </div>
            <div>
              <span style={{ color: CCT_COLORS.threat }}>→ </span>
              {cctScore.threats.found}/{cctScore.threats.total}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!cctRevealed ? (
        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl font-bold text-white transition-colors"
          style={{ backgroundColor: stepColor }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {cctEntries.length === 0 ? 'Skip →' : "I'm Done →"}
        </button>
      ) : !thresholdMet && totalCount > 0 ? (
        <div>
          <div className="px-3 py-2 rounded-lg text-xs text-center mb-2"
            style={{ backgroundColor: '#c93a3a15', color: '#f87171', border: '1px solid #c93a3a33' }}>
            Find at least {Math.ceil(totalCount * thresholdPct)} of {totalCount} total CCTs to proceed.
            You found {foundCount}.
          </div>
          <button
            onClick={onGoBack || onDone}
            className="w-full py-3 rounded-xl font-bold transition-colors"
            style={{ backgroundColor: '#3a3734', color: '#bababa' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#3a3734')}
          >
            ← Go Back & Find More
          </button>
        </div>
      ) : (
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl font-bold text-white transition-colors"
          style={{ backgroundColor: nextColor }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

// ─── Puzzle List Modal ───────────────────────────────────────────────────────────

function PuzzleListModal({
  isOpen,
  onClose,
  puzzles,
  currentPuzzleIndex,
  completedPuzzleIds,
  onJumpToPuzzle,
  puzzleScores = {},
}) {
  if (!isOpen) return null;

  // Filter and search state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all'); // 'all', 'completed', 'pending', 'unlocked'

  // Determine which puzzles are unlocked based on sequential completion
  // First puzzle is always unlocked; each subsequent puzzle unlocks when previous is completed
  const unlockedIndices = React.useMemo(() => {
    const unlocked = new Set([0]); // First puzzle always unlocked
    for (let i = 0; i < puzzles.length - 1; i++) {
      if (completedPuzzleIds.includes(puzzles[i].id)) {
        unlocked.add(i + 1);
      } else {
        break; // Stop at first incomplete puzzle
      }
    }
    return unlocked;
  }, [puzzles, completedPuzzleIds]);

  const filteredPuzzles = React.useMemo(() => {
    return puzzles.filter((p, idx) => {
      const isCompleted = completedPuzzleIds.includes(p.id);
      const isUnlocked = unlockedIndices.has(idx);
      const matchesSearch = !searchQuery ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.themes?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter = filterStatus === 'all' ||
        (filterStatus === 'completed' && isCompleted) ||
        (filterStatus === 'pending' && !isCompleted && isUnlocked) ||
        (filterStatus === 'unlocked' && isUnlocked);

      return matchesSearch && matchesFilter;
    });
  }, [puzzles, completedPuzzleIds, unlockedIndices, searchQuery, filterStatus]);

  const handlePuzzleClick = (index) => {
    if (!unlockedIndices.has(index)) return; // Locked
    onJumpToPuzzle(index);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#312e2b', border: '2px solid #4a4744' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: '#4a4744' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📋 Puzzle List
            </h2>
            <button
              onClick={onClose}
              className="text-2xl transition-colors"
              style={{ color: '#8b8987' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#bababa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8b8987')}
            >
              ✕
            </button>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by ID or theme..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg text-sm text-white placeholder-gray-500"
              style={{ backgroundColor: '#1a1916', border: '1px solid #4a4744' }}
            />
            <div className="flex gap-2">
              {['all', 'unlocked', 'completed', 'pending'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className="px-3 py-2 rounded-lg text-xs font-bold capitalize transition-colors"
                  style={{
                    backgroundColor: filterStatus === status ? '#81b64c22' : '#1a1916',
                    color: filterStatus === status ? '#81b64c' : '#6b7280',
                    border: `1px solid ${filterStatus === status ? '#81b64c' : '#4a4744'}`,
                  }}
                >
                  {status === 'unlocked' ? '🔓 Unlocked' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-3 text-xs" style={{ color: '#8b8987' }}>
            <span>Showing {filteredPuzzles.length} of {puzzles.length} puzzles</span>
            <span>✓ {completedPuzzleIds.length} completed</span>
            <span>🔓 {unlockedIndices.size} unlocked</span>
            <span>🔒 {puzzles.length - unlockedIndices.size} locked</span>
          </div>
        </div>

        {/* Puzzle list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPuzzles.map((puzzle, filteredIdx) => {
              const actualIndex = puzzles.indexOf(puzzle);
              const isCurrent = actualIndex === currentPuzzleIndex;
              const isCompleted = completedPuzzleIds.includes(puzzle.id);
              const isUnlocked = unlockedIndices.has(actualIndex);

              return (
                <button
                  key={puzzle.id}
                  onClick={() => handlePuzzleClick(actualIndex)}
                  disabled={!isUnlocked}
                  className="p-3 rounded-xl text-left transition-all relative"
                  style={{
                    backgroundColor: isCurrent ? '#81b64c22' : (!isUnlocked ? '#1a1916' : '#1a1916'),
                    border: `2px solid ${isCurrent ? '#81b64c' : (!isUnlocked ? '#3a3734' : '#4a4744')}`,
                    opacity: isCurrent ? 1 : (!isUnlocked ? 0.4 : 0.85),
                    cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  }}
                  onMouseEnter={e => isUnlocked && !isCurrent && (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => isUnlocked && !isCurrent && (e.currentTarget.style.opacity = '0.85')}
                >
                  {/* Lock overlay for locked puzzles */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <span className="text-2xl">🔒</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold"
                        style={{ color: isCurrent ? '#81b64c' : isCompleted ? '#81b64c' : (!isUnlocked ? '#4a4744' : '#bababa') }}
                      >
                        #{actualIndex + 1}
                      </span>
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#262421', color: '#5b5754' }}
                      >
                        {puzzle.id}
                      </span>
                    </div>
                    <span className="text-lg">
                      {isCurrent ? '▶️' : isCompleted ? '✅' : (!isUnlocked ? '🔒' : '◌')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: puzzle.difficulty === 'easy' ? '#81b64c22' : puzzle.difficulty === 'hard' ? '#c9882a22' : puzzle.difficulty === 'very hard' ? '#c93a3a22' : '#5b8dd922',
                        color: puzzle.difficulty === 'easy' ? '#81b64c' : puzzle.difficulty === 'hard' ? '#c9882a' : puzzle.difficulty === 'very hard' ? '#c93a3a' : '#5b8dd9',
                        opacity: isUnlocked ? 1 : 0.5,
                      }}
                    >
                      {puzzle.difficulty}
                    </span>
                    {puzzle.themes?.slice(0, 2).map((theme, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: '#262421', color: isUnlocked ? '#6b7280' : '#4a4744' }}
                      >
                        {theme.replace(/([A-Z])/g, ' $1').trim().slice(0, 12)}
                      </span>
                    ))}
                    {isCompleted && puzzleScores[actualIndex] && (
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{
                          backgroundColor: puzzleScores[actualIndex].combined >= 80 ? '#81b64c22' : puzzleScores[actualIndex].combined >= 50 ? '#c9882a22' : '#c93a3a22',
                          color: puzzleScores[actualIndex].combined >= 80 ? '#81b64c' : puzzleScores[actualIndex].combined >= 50 ? '#c9882a' : '#c93a3a',
                        }}
                      >
                        {puzzleScores[actualIndex].combined}pts
                      </span>
                    )}
                  </div>

                  {/* Locked badge */}
                  {!isUnlocked && (
                    <div className="mt-2 text-xs text-center" style={{ color: '#4a4744' }}>
                      Complete previous puzzle to unlock
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Empty state for locked puzzles */}
          {filterStatus === 'unlocked' && filteredPuzzles.length === 0 && unlockedIndices.size === 1 && (
            <div className="text-center py-8" style={{ color: '#6b7280' }}>
              <div className="text-4xl mb-2">🔒</div>
              <p className="text-sm">Complete more puzzles to unlock the rest!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-center" style={{ borderColor: '#4a4744' }}>
          <button
            onClick={onClose}
            className="text-sm font-bold px-6 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#4a4744', color: '#bababa' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a5754')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4a4744')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
