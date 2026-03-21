import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const TIER_COLORS = {
  beginner: { bg: '#4CAF50', text: '#fff', label: 'Beginner' },
  intermediate: { bg: '#2196F3', text: '#fff', label: 'Intermediate' },
  advanced: { bg: '#9C27B0', text: '#fff', label: 'Advanced' },
};

const TIER_ICONS = { beginner: '🌱', intermediate: '🎯', advanced: '🏆' };
const TYPE_ICONS = { tactic: '⚡', endgame: '♟️', opening: '📖', puzzle: '🧩' };

const DailyChallengePage = () => {
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game state
  const [game, setGame] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [status, setStatus] = useState('loading'); // loading, playing, correct, incorrect, completed
  const [moveHistory, setMoveHistory] = useState([]);
  const [hintIndex, setHintIndex] = useState(-1);
  const [attempts, setAttempts] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [squareStyles, setSquareStyles] = useState({});
  const [selectedSquare, setSelectedSquare] = useState(null);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Streak
  const [streak, setStreak] = useState(0);

  // Load daily challenge
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        setLoading(true);
        const res = await api.get('/tutorial/daily-challenge');
        const data = res.data.data || res.data;
        setChallenge(data);

        // Check if already completed
        if (data.user_completion?.completed) {
          setStatus('completed');
          setXpAwarded(data.xp_reward);
        } else {
          setStatus('playing');
        }

        // Initialize chess game from FEN
        const fen = data.challenge_data?.fen;
        if (fen) {
          const g = new Chess(fen);
          setGame(g);
          const turn = fen.split(' ')[1];
          setBoardOrientation(turn === 'b' ? 'black' : 'white');
        }

        setAttempts(data.user_completion?.attempts || 0);

        // Load streak
        if (user) {
          try {
            const statsRes = await api.get('/tutorial/progress/stats');
            const stats = statsRes.data.data || statsRes.data;
            setStreak(stats.daily_streak || 0);
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('[DailyChallenge] Error loading:', err);
        setError(err.response?.status === 401 ? 'Please log in to access daily challenges.' : 'Failed to load daily challenge.');
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [user]);

  // Timer
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Format timer
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Shared move logic — used by both drag-drop and click-to-move
  const tryMove = useCallback((sourceSquare, targetSquare) => {
    if (status !== 'playing' || !game) return false;

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });

    if (!move) return false;

    setGame(gameCopy);
    setSelectedSquare(null);
    const newHistory = [...moveHistory, move.san];
    setMoveHistory(newHistory);

    // Highlight the move
    setSquareStyles({
      [sourceSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      [targetSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
    });

    // Check if move matches solution
    const solution = challenge.challenge_data?.solution || [];
    const moveIndex = newHistory.length - 1;

    if (moveIndex < solution.length) {
      const expected = solution[moveIndex].replace(/[#+ ]/g, '');
      const actual = move.san.replace(/[#+ ]/g, '');

      if (expected.toLowerCase() === actual.toLowerCase()) {
        if (newHistory.length === solution.length) {
          handleSolved(newHistory);
        }
      } else {
        handleWrongMove(gameCopy);
      }
    }

    return true;
  }, [game, moveHistory, challenge, status]);

  // Drag-and-drop handler
  const onDrop = useCallback((sourceSquare, targetSquare) => {
    return tryMove(sourceSquare, targetSquare);
  }, [tryMove]);

  // Click-to-move handler
  const onSquareClick = useCallback((square) => {
    if (status !== 'playing' || !game) return;

    const piece = game.get(square);

    // If no square selected yet, select this square if it has a piece of the right color
    if (!selectedSquare) {
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        // Highlight selected square and legal moves
        const moves = game.moves({ square, verbose: true });
        const highlights = { [square]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } };
        moves.forEach(m => {
          highlights[m.to] = {
            background: game.get(m.to)
              ? 'radial-gradient(circle, rgba(0,0,0,0.1) 85%, transparent 85%)'
              : 'radial-gradient(circle, rgba(0,0,0,0.15) 25%, transparent 25%)',
            borderRadius: '50%',
          };
        });
        setSquareStyles(highlights);
      }
      return;
    }

    // If clicking the same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setSquareStyles({});
      return;
    }

    // If clicking another own piece, switch selection
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      const highlights = { [square]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } };
      moves.forEach(m => {
        highlights[m.to] = {
          background: game.get(m.to)
            ? 'radial-gradient(circle, rgba(0,0,0,0.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,0.15) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      });
      setSquareStyles(highlights);
      return;
    }

    // Try to make the move
    const moved = tryMove(selectedSquare, square);
    if (!moved) {
      // Invalid move — deselect
      setSelectedSquare(null);
      setSquareStyles({});
    }
  }, [game, selectedSquare, status, tryMove]);

  const handleSolved = async (moves) => {
    clearInterval(timerRef.current);
    setStatus('correct');

    try {
      const res = await api.post('/tutorial/daily-challenge/submit', {
        solution: moves,
        time_spent_seconds: elapsed,
      });
      const data = res.data.data || res.data;
      setXpAwarded(data.xp_awarded || 0);
      if (data.xp_awarded) {
        setStatus('correct');
      }
    } catch (err) {
      console.error('[DailyChallenge] Submit error:', err);
      // Still show correct locally
    }
  };

  const handleWrongMove = (gameCopy) => {
    setAttempts(a => a + 1);
    setSquareStyles({});

    // Flash red briefly, then reset
    setStatus('incorrect');
    setTimeout(() => {
      // Reset to original position
      const fen = challenge.challenge_data?.fen;
      if (fen) {
        setGame(new Chess(fen));
      }
      setMoveHistory([]);
      setStatus('playing');
    }, 1200);
  };

  const handleShowHint = () => {
    const hints = challenge?.challenge_data?.hints || [];
    if (hintIndex < hints.length - 1) {
      setHintIndex(h => h + 1);
    }
  };

  const handleShowSolution = () => {
    setShowSolution(true);
    clearInterval(timerRef.current);
  };

  const handleRetry = () => {
    const fen = challenge?.challenge_data?.fen;
    if (fen) {
      setGame(new Chess(fen));
    }
    setMoveHistory([]);
    setSquareStyles({});
    setHintIndex(-1);
    setShowSolution(false);
    setStatus('playing');
    setElapsed(0);
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#262421' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#262421', color: '#bababa' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🧩</p>
          <p style={{ fontSize: 18 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!challenge) return null;

  const data = challenge.challenge_data || {};
  const tier = TIER_COLORS[challenge.skill_tier] || TIER_COLORS.beginner;
  const hints = data.hints || [];
  const solution = data.solution || [];
  const isComplete = status === 'correct' || status === 'completed';

  return (
    <div style={{ minHeight: '100vh', background: '#262421', color: '#bababa', padding: '16px 8px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', margin: 0 }}>
            {TYPE_ICONS[challenge.challenge_type] || '🧩'} Daily Challenge
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: tier.bg, color: tier.text,
              padding: '2px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            }}>
              {TIER_ICONS[challenge.skill_tier]} {tier.label}
            </span>
            <span style={{
              background: '#312e2b', color: '#bababa',
              padding: '2px 12px', borderRadius: 12, fontSize: 13,
            }}>
              {challenge.challenge_type_display || challenge.challenge_type}
            </span>
            {streak > 0 && (
              <span style={{
                background: '#FF9800', color: '#fff',
                padding: '2px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              }}>
                🔥 {streak} day streak
              </span>
            )}
          </div>
        </div>

        {/* Puzzle info */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, color: '#fff', margin: '0 0 4px 0' }}>
            {data.title || 'Puzzle'}
          </h2>
          <p style={{ fontSize: 14, color: '#999', margin: 0 }}>
            {data.description || 'Find the best move.'}
          </p>
        </div>

        {/* Timer & Attempts */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>⏱️ {formatTime(elapsed)}</span>
          <span style={{ fontSize: 14 }}>Attempts: {attempts}</span>
          <span style={{ fontSize: 14 }}>+{challenge.xp_reward} XP</span>
        </div>

        {/* Chessboard with overlay for completion */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: '100%', maxWidth: 480, position: 'relative' }}>
            {/* Board dimming overlay when complete */}
            {isComplete && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.55)', zIndex: 10, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  textAlign: 'center', padding: '24px 20px',
                  background: 'linear-gradient(135deg, rgba(38,36,33,0.97), rgba(49,46,43,0.97))',
                  borderRadius: 12, border: '1px solid rgba(76,175,80,0.4)',
                  maxWidth: '85%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <p style={{ margin: 0, fontSize: 40 }}>{status === 'correct' ? '🎉' : '🏆'}</p>
                  <p style={{ margin: '8px 0 4px', color: '#4CAF50', fontWeight: 700, fontSize: 18 }}>
                    Daily Challenge Complete!
                  </p>
                  <p style={{ margin: 0, color: '#bababa', fontSize: 14 }}>
                    You earned <strong style={{ color: '#81b64c' }}>+{xpAwarded || challenge.xp_reward} XP</strong> today.
                  </p>
                  {streak > 0 && (
                    <p style={{ margin: '8px 0 0', color: '#FF9800', fontSize: 14, fontWeight: 600 }}>
                      🔥 {streak} day streak
                    </p>
                  )}
                  <p style={{ margin: '12px 0 0', color: '#777', fontSize: 12 }}>
                    ⏰ New challenge at midnight
                  </p>
                </div>
              </div>
            )}

            <Chessboard
              id="daily-challenge-board"
              position={game?.fen() || 'start'}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardOrientation={boardOrientation}
              boardWidth={Math.min(480, typeof window !== 'undefined' ? window.innerWidth - 32 : 480)}
              arePiecesDraggable={status === 'playing'}
              customBoardStyle={{
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
              customDarkSquareStyle={{ backgroundColor: '#779952' }}
              customLightSquareStyle={{ backgroundColor: '#edeed1' }}
              customSquareStyles={squareStyles}
            />
          </div>
        </div>

        {/* Wrong move feedback (below board) */}
        {status === 'incorrect' && (
          <div style={{
            textAlign: 'center', padding: '12px', marginBottom: 12,
            background: 'rgba(244,67,54,0.15)', borderRadius: 8, border: '1px solid rgba(244,67,54,0.3)',
          }}>
            <p style={{ margin: 0, color: '#f44336', fontWeight: 600 }}>
              ❌ Wrong move! Try again.
            </p>
          </div>
        )}

        {/* Action buttons */}
        {status === 'playing' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={handleShowHint}
              disabled={hintIndex >= hints.length - 1}
              style={{
                background: '#312e2b', color: '#bababa', border: '1px solid #454341',
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
                opacity: hintIndex >= hints.length - 1 ? 0.5 : 1,
              }}
            >
              💡 Hint {hintIndex + 1 < hints.length ? `(${hintIndex + 2}/${hints.length})` : '(used all)'}
            </button>
            <button
              onClick={handleShowSolution}
              style={{
                background: '#312e2b', color: '#bababa', border: '1px solid #454341',
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
              }}
            >
              👁️ Show Solution
            </button>
            <button
              onClick={handleRetry}
              style={{
                background: '#312e2b', color: '#bababa', border: '1px solid #454341',
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
              }}
            >
              🔄 Reset
            </button>
          </div>
        )}

        {isComplete && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                background: '#81b64c', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              🏠 Back to Dashboard
            </button>
          </div>
        )}

        {/* Hints display */}
        {hintIndex >= 0 && (
          <div style={{
            background: '#312e2b', borderRadius: 8, padding: '12px 16px', marginBottom: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#999' }}>💡 Hints:</p>
            {hints.slice(0, hintIndex + 1).map((hint, i) => (
              <p key={i} style={{ margin: '4px 0 0 0', fontSize: 14, color: '#e0e0e0' }}>
                {i + 1}. {hint}
              </p>
            ))}
          </div>
        )}

        {/* Solution display */}
        {showSolution && (
          <div style={{
            background: '#312e2b', borderRadius: 8, padding: '12px 16px', marginBottom: 12,
            border: '1px solid #81b64c33',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#81b64c' }}>✅ Solution:</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 16, color: '#fff', fontWeight: 600 }}>
              {solution.join(', ')}
            </p>
          </div>
        )}

        {/* Stats */}
        <div style={{
          background: '#312e2b', borderRadius: 8, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-around', fontSize: 13,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#999' }}>Solved by</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{challenge.completion_count || 0} players</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#999' }}>Success rate</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{challenge.success_rate || 0}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#999' }}>XP reward</div>
            <div style={{ color: '#81b64c', fontWeight: 600 }}>+{challenge.xp_reward}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyChallengePage;
