/**
 * Championship Victory Test Component
 * Tests GameCompletionAnimation and GameEndCard with championship data
 * Simulates a victory in a championship match
 */

import React, { useState, useEffect } from 'react';
import GameCompletionAnimation from '../components/GameCompletionAnimation';
import GameEndCard from '../components/GameEndCard';
import { BACKEND_URL } from '../config';

const ChampionshipVictoryTest = () => {
  const [showAnimation, setShowAnimation] = useState(false);
  const [showEndCard, setShowEndCard] = useState(false);
  const [testScenario, setTestScenario] = useState('victory');
  const [gameMode, setGameMode] = useState('multiplayer');
  const [isChampionship, setIsChampionship] = useState(true);
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Computer opponents for computer mode
  const computerOpponents = [
    { id: 'computer_1', name: 'Stockfish 16', rating: 3500, country: '🤖', avatar: null },
    { id: 'computer_2', name: 'AlphaZero', rating: 3400, country: '🤖', avatar: null },
    { id: 'computer_3', name: 'Komodo Dragon', rating: 3300, country: '🤖', avatar: null }
  ];

  // Fetch real users from database
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/users`);
        if (response.ok) {
          const usersData = await response.json();
          // Add country flags for users (random assignment if not available)
          const usersWithFlags = usersData.map(user => ({
            ...user,
            country: user.country || '🌍' // Default flag if none specified
          }));
          setUsers(usersWithFlags);

          // Set default player selections if available
          if (usersWithFlags.length >= 2) {
            setPlayer1(usersWithFlags[0].id);
            setPlayer2(usersWithFlags[1].id);
          }
        } else {
          console.error('Failed to fetch users');
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Get selected player objects
  const selectedPlayer1 = users.find(u => u.id === player1);
  const selectedPlayer2 = users.find(u => u.id === player2);

  // Sample championship data
  const championshipData = {
    tournamentName: "Spring Championship 2025",
    round: 3,
    matchId: `match_${Date.now()}`,
    standing: "#5 of 32",
    points: 21
  };

  // Helper function to generate dynamic result data
  const generateResultData = (scenario) => {
    const isComputerMode = gameMode === 'computer';
    const player1Data = isComputerMode ? (users[0] || { id: 'user_1', name: 'Player', rating: 1500, country: '🌍', avatar: null }) : (selectedPlayer1 || { id: 'user_1', name: 'Player', rating: 1500, country: '🌍', avatar: null });
    const player2Data = isComputerMode ? (computerOpponents[0]) : (selectedPlayer2 || { id: 'user_2', name: 'Opponent', rating: 1500, country: '🌍', avatar: null });

    // Determine winner based on scenario
    let winner, winner_color, loser_color, playerColor;
    let ratingChange1, ratingChange2;

    if (scenario === 'victory') {
      // Player 1 wins
      winner = 'player';
      winner_color = 'white';
      loser_color = 'black';
      playerColor = 'white';
      ratingChange1 = +15;
      ratingChange2 = -15;
    } else if (scenario === 'loss') {
      // Player 2 wins
      winner = 'opponent';
      winner_color = 'black';
      loser_color = 'white';
      playerColor = 'white';
      ratingChange1 = -12;
      ratingChange2 = +12;
    } else {
      // Draw
      winner = null;
      winner_color = null;
      loser_color = null;
      playerColor = Math.random() > 0.5 ? 'white' : 'black';
      ratingChange1 = +5;
      ratingChange2 = +5;
    }

    return {
      result: scenario === 'victory' ? '1-0' : scenario === 'loss' ? '0-1' : '1/2-1/2',
      winner: scenario === 'victory' ? 'player' : scenario === 'loss' ? 'opponent' : null,
      end_reason: scenario === 'draw' ? 'Stalemate' : 'Checkmate',
      moves: Math.floor(Math.random() * 40) + 30,
      capturedPieces: {
        white: ['♟', '♟', '♞'],
        black: ['♙', '♙', '♗', '♘']
      },
      player_color: playerColor === 'white' ? 'w' : 'b',
      white_player: {
        id: player1Data.id,
        name: player1Data.name,
        rating: player1Data.rating,
        country: player1Data.country,
        avatar: player1Data.avatar
      },
      black_player: {
        id: player2Data.id,
        name: player2Data.name,
        rating: player2Data.rating,
        country: player2Data.country,
        avatar: player2Data.avatar
      },
      rating_change: ratingChange1,
      timeSpent: `${Math.floor(Math.random() * 20) + 10}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      accuracy: Math.floor(Math.random() * 25) + 70
    };
  };

  const currentResult = generateResultData(testScenario);

  const handleAnimationClose = () => {
    setShowAnimation(false);
    setShowEndCard(true);
  };

  const handleEndCardClose = () => {
    setShowEndCard(false);
  };

  const handleRestart = () => {
    setShowEndCard(false);
  };

  const generateEndCard = () => {
    setShowAnimation(false);
    setShowEndCard(true);
  };

  const generateWithAnimation = () => {
    setShowAnimation(true);
    setShowEndCard(false);
  };

  const closeAll = () => {
    setShowAnimation(false);
    setShowEndCard(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a2e',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Test Control Panel */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto 20px',
        backgroundColor: '#16213e',
        padding: '25px',
        borderRadius: '15px',
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#4ecca3', textAlign: 'center', fontSize: '24px' }}>
          🎮 Game End Card Test Panel
        </h2>

        {/* Game Mode Selection */}
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#4ecca3', fontSize: '16px' }}>🎯 Game Mode:</strong>
          <div style={{ marginTop: '10px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="gameMode"
                value="multiplayer"
                checked={gameMode === 'multiplayer'}
                onChange={(e) => setGameMode(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
              <span>👥 Multiplayer</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="gameMode"
                value="computer"
                checked={gameMode === 'computer'}
                onChange={(e) => setGameMode(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
              <span>🤖 Computer</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="gameMode"
                value="championship"
                checked={gameMode === 'championship'}
                onChange={(e) => setGameMode(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
              <span>🏆 Championship</span>
            </label>
          </div>
        </div>

        {/* Player Selection */}
        {(gameMode === 'multiplayer' || gameMode === 'championship') && (
          <div style={{ marginBottom: '20px' }}>
            <strong style={{ color: '#4ecca3', fontSize: '16px' }}>👤 Select Players:</strong>
            {loading ? (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#0f3460',
                borderRadius: '8px',
                border: '1px solid #4ecca3',
                color: '#fff',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                Loading registered users from database...
              </div>
            ) : users.length === 0 ? (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#e94560',
                borderRadius: '8px',
                border: '1px solid #e94560',
                color: '#fff',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                No registered users found in database
              </div>
            ) : (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#fff' }}>
                    ⚪ White Player:
                  </label>
                  <select
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#0f3460',
                      color: '#fff',
                      border: '1px solid #4ecca3',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.country} {user.name} ({user.rating || 1500})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#fff' }}>
                    ⚫ Black Player:
                  </label>
                  <select
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#0f3460',
                      color: '#fff',
                      border: '1px solid #4ecca3',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {users.filter(u => u.id !== player1).map(user => (
                      <option key={user.id} value={user.id}>
                        {user.country} {user.name} ({user.rating || 1500})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Computer Mode Display */}
        {gameMode === 'computer' && (
          <div style={{ marginBottom: '20px' }}>
            <strong style={{ color: '#4ecca3', fontSize: '16px' }}>🤖 Computer Match:</strong>
            <div style={{
              marginTop: '10px',
              padding: '12px',
              backgroundColor: '#0f3460',
              borderRadius: '8px',
              border: '1px solid #4ecca3',
              color: '#fff',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '5px' }}>⚪ You (White) vs ⚫ Computer (Black)</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                Playing against: {computerOpponents[0]?.name || 'Stockfish 16'}
              </div>
            </div>
          </div>
        )}

        {/* Championship Toggle */}
        {gameMode !== 'championship' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isChampionship}
                onChange={(e) => setIsChampionship(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#4ecca3', fontSize: '16px' }}>🏆 Championship Mode</span>
            </label>
          </div>
        )}

        {/* Result Type Selection */}
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#4ecca3', fontSize: '16px' }}>📊 Result Type:</strong>
          <div style={{ marginTop: '10px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTestScenario('victory')}
              style={{
                padding: '12px 25px',
                backgroundColor: testScenario === 'victory' ? '#4ecca3' : '#0f3460',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: testScenario === 'victory' ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              🏆 Victory
            </button>
            <button
              onClick={() => setTestScenario('draw')}
              style={{
                padding: '12px 25px',
                backgroundColor: testScenario === 'draw' ? '#4ecca3' : '#0f3460',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: testScenario === 'draw' ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              ♟️ Draw
            </button>
            <button
              onClick={() => setTestScenario('loss')}
              style={{
                padding: '12px 25px',
                backgroundColor: testScenario === 'loss' ? '#4ecca3' : '#0f3460',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: testScenario === 'loss' ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              💔 Loss
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#4ecca3', fontSize: '16px' }}>🚀 Generate End Card:</strong>
          <div style={{ marginTop: '10px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <button
              onClick={generateEndCard}
              style={{
                padding: '12px 25px',
                backgroundColor: '#4ecca3',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              ⚡ Show End Card Only
            </button>
            <button
              onClick={generateWithAnimation}
              style={{
                padding: '12px 25px',
                backgroundColor: '#e94560',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              🎬 Animation → End Card
            </button>
            <button
              onClick={closeAll}
              style={{
                padding: '12px 25px',
                backgroundColor: '#636e72',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
            >
              ❌ Close All
            </button>
          </div>
        </div>

        {/* Current Status */}
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#4ecca3', fontSize: '16px' }}>📈 Current Status:</strong>
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#0f3460', borderRadius: '8px' }}>
            <div>🎮 Mode: <span style={{ color: '#4ecca3' }}>{gameMode}</span></div>
            <div>🏆 Championship: <span style={{ color: isChampionship ? '#4ecca3' : '#e94560' }}>{isChampionship ? 'Yes' : 'No'}</span></div>
            <div>📊 Result: <span style={{ color: '#4ecca3' }}>{testScenario.charAt(0).toUpperCase() + testScenario.slice(1)}</span></div>

            {(gameMode === 'multiplayer' || gameMode === 'championship') && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <div>⚪ White: <span style={{ color: '#4ecca3' }}>{selectedPlayer1?.country} {selectedPlayer1?.name} ({selectedPlayer1?.rating})</span></div>
                <div>⚫ Black: <span style={{ color: '#4ecca3' }}>{selectedPlayer2?.country} {selectedPlayer2?.name} ({selectedPlayer2?.rating})</span></div>
              </div>
            )}

            {gameMode === 'computer' && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <div>⚪ You (White): <span style={{ color: '#4ecca3' }}>{users[0]?.country || '🌍'} {users[0]?.name || 'Player'}</span></div>
                <div>⚫ Computer (Black): <span style={{ color: '#4ecca3' }}>{computerOpponents[0]?.country} {computerOpponents[0]?.name}</span></div>
              </div>
            )}

            <div style={{ marginTop: '8px' }}>
              {showAnimation && '🎬 Animation Phase Active'}
              {showEndCard && '📊 End Card Phase Active'}
              {!showAnimation && !showEndCard && '⚪ Ready to Generate'}
            </div>
          </div>
        </div>

        {/* Configuration Summary */}
        <details style={{ marginBottom: '20px' }}>
          <summary style={{ cursor: 'pointer', color: '#4ecca3', fontSize: '16px', fontWeight: 'bold' }}>
            🔧 View Configuration Data
          </summary>
          <div style={{ marginTop: '15px' }}>
            <div style={{ marginBottom: '15px' }}>
              <strong>Championship Data:</strong>
              <pre style={{
                backgroundColor: '#0f3460',
                padding: '10px',
                borderRadius: '5px',
                overflow: 'auto',
                fontSize: '11px',
                marginTop: '5px',
                maxHeight: '150px'
              }}>
                {JSON.stringify(championshipData, null, 2)}
              </pre>
            </div>
            <div>
              <strong>Game Result Data ({testScenario}):</strong>
              <pre style={{
                backgroundColor: '#0f3460',
                padding: '10px',
                borderRadius: '5px',
                overflow: 'auto',
                fontSize: '11px',
                marginTop: '5px',
                maxHeight: '200px'
              }}>
                {JSON.stringify(currentResult, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </div>

      {/* Test Components */}
      {showAnimation && (
        <GameCompletionAnimation
          result={currentResult}
          isMultiplayer={gameMode === 'multiplayer'}
          championshipData={(gameMode === 'championship' || isChampionship) ? championshipData : null}
          onClose={handleAnimationClose}
          playerColor={currentResult.player_color === 'w' ? 'white' : 'black'}
        />
      )}

      {showEndCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <GameEndCard
            result={currentResult}
            isMultiplayer={gameMode === 'multiplayer'}
            championshipData={(gameMode === 'championship' || isChampionship) ? championshipData : null}
            onClose={handleEndCardClose}
            onRestart={handleRestart}
            playerColor={currentResult.player_color === 'w' ? 'white' : 'black'}
          />
        </div>
      )}

      {/* Instructions */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: '#16213e',
        padding: '25px',
        borderRadius: '15px',
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#4ecca3', textAlign: 'center', fontSize: '20px' }}>
          📋 How to Use the Test Panel
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <h4 style={{ color: '#4ecca3', marginBottom: '10px' }}>🎯 Step 1: Configure Mode</h4>
            <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
              <li>Choose <strong>Multiplayer</strong> for player vs player</li>
              <li>Choose <strong>Computer</strong> for AI games</li>
              <li>Choose <strong>Championship</strong> for tournament mode</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#4ecca3', marginBottom: '10px' }}>👤 Step 2: Select Players</h4>
            <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
              <li><strong>Multiplayer/Championship:</strong> Choose two players</li>
              <li><strong>Computer:</strong> You vs AI (automatic)</li>
              <li>Player names and ratings update dynamically</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#4ecca3', marginBottom: '10px' }}>📊 Step 3: Select Result</h4>
            <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
              <li><strong>🏆 Victory:</strong> White player wins</li>
              <li><strong>♟️ Draw:</strong> Balanced outcome</li>
              <li><strong>💔 Loss:</strong> Black player wins</li>
            </ul>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#4ecca3', marginBottom: '10px' }}>🚀 Step 4: Generate Cards</h4>
          <ul style={{ lineHeight: '1.6', paddingLeft: '20px' }}>
            <li><strong>⚡ Show End Card Only:</strong> Direct display of results card</li>
            <li><strong>🎬 Animation → End Card:</strong> Full flow with animation first</li>
            <li><strong>❌ Close All:</strong> Clear all displayed components</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#4ecca3', marginBottom: '10px' }}>✅ Test Features</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <strong>🏆 Championship Features:</strong>
              <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
                <li>Tournament name & round display</li>
                <li>Championship progress card</li>
                <li>Context-aware messages</li>
                <li>Enhanced share functionality</li>
              </ul>
            </div>
            <div>
              <strong>👤 Player Features:</strong>
              <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
                <li>Dynamic player selection</li>
                <li>Real player names & ratings</li>
                <li>Country flags display</li>
                <li>AI opponents for computer mode</li>
              </ul>
            </div>
            <div>
              <strong>🎮 Core Features:</strong>
              <ul style={{ lineHeight: '1.5', paddingLeft: '20px', fontSize: '13px' }}>
                <li>Close button (×) on all cards</li>
                <li>Smooth animations & transitions</li>
                <li>Share with friends functionality</li>
                <li>Rating change with colors</li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{
          padding: '15px',
          backgroundColor: '#0f3460',
          borderRadius: '10px',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          <strong style={{ color: '#4ecca3' }}>💡 Pro Tip:</strong> Test different combinations of modes and results to ensure all UI variations work correctly!
        </div>
      </div>
    </div>
  );
};

export default ChampionshipVictoryTest;
