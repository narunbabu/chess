
import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from 'react-dom'; // Import ReactDOM
import { useLocation } from "react-router-dom";
import { useAppData } from "../contexts/AppDataContext";
import {
  getGameHistories,
  getGameHistoryById,
} from "../services/gameHistoryService";
import {
  extractGameSummary,
  sortGameHistories,
  filterGameHistories,
  getGamePGN,
} from "../utils/gameHistoryUtils";
import ChessBoard from "./play/ChessBoard";
import { Chess } from "chess.js";
import { reconstructGameFromHistory, formatMoveDescription } from "../utils/gameHistoryStringUtils"; // Import the new function
import { isWin, isLoss, getResultDisplayText } from "../utils/resultStandardization";
import GIF from 'gif.js';
import html2canvas from 'html2canvas';
import logo from '../assets/images/logo.png'; // Import the logo

const GameHistory = () => {
  const location = useLocation();
  const [gameHistories, setGameHistories] = useState([]);
  const [filteredHistories, setFilteredHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [filters, setFilters] = useState({
    playerColor: "",
    result: "",
    level: "",
  });
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [boardPosition, setBoardPosition] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef(null);
  const chessGameRef = useRef(null);
  const [gifExporting, setGifExporting] = useState(false); // State for GIF export loading
  const [mp4Exporting, setMp4Exporting] = useState(false); // State for MP4 export loading

  
  // Handle incoming game ID from navigation state
  useEffect(() => {
    if (location.state?.gameIdToSelect) {
      const gameId = location.state.gameIdToSelect;
      const gameToSelect = gameHistories.find(g => g.id === gameId);
      if (gameToSelect) {
        handleGameSelect(gameToSelect);
      }
    }
  }, [gameHistories, location.state]);

  // Helper function: Ensure moves is an array
  const ensureMovesArray = (game) => {
    if (game && game.moves) {
      if (typeof game.moves === "string") {
        try {
          return { ...game, moves: JSON.parse(game.moves) };
        } catch (error) {
          console.error("Error parsing moves JSON:", error);
          return { ...game, moves: [] };
        }
      }
    }
    return game;
  };

  const { getGameHistory } = useAppData();
  const didFetchRef = useRef(false);

  // Load game histories on component mount
  useEffect(() => {
    // Prevent duplicate fetches in StrictMode
    if (didFetchRef.current) {
      console.log('[GameHistory] Already fetched, skipping');
      return;
    }
    didFetchRef.current = true;

    const loadGameHistories = async () => {
      try {
        // Use cached getGameHistory
        const histories = await getGameHistory();
        const sortedHistories = sortGameHistories(histories || []);
        setGameHistories(sortedHistories);
        setFilteredHistories(sortedHistories);
        setLoading(false);
      } catch (error) {
        console.error("[GameHistory] Error loading from cache:", error);
        // Fallback to direct fetch
        try {
          const histories = await getGameHistories();
          const sortedHistories = sortGameHistories(histories);
          setGameHistories(sortedHistories);
          setFilteredHistories(sortedHistories);
        } catch (fallbackError) {
          console.error("[GameHistory] Fallback fetch failed:", fallbackError);
        } finally {
          setLoading(false);
        }
      }
    };

    loadGameHistories();

    return () => {
      didFetchRef.current = false;
    };
  }, [getGameHistory]);

  // Apply filters when they change
  useEffect(() => {
    const applyFilters = () => {
      const filtered = filterGameHistories(gameHistories, filters);
      setFilteredHistories(filtered);
    };

    applyFilters();
  }, [filters, gameHistories]);

  // When a game is selected, ensure its moves property is an array
  useEffect(() => {
    if (selectedGame) {
      const gameWithMovesArray = ensureMovesArray(selectedGame);
      setSelectedGame(gameWithMovesArray);
      chessGameRef.current = new Chess();
      setCurrentMoveIndex(0);
      setBoardPosition(chessGameRef.current.fen());
    }
  }, [selectedGame]);

  // Update board position when current move index changes
  useEffect(() => {
    if (!selectedGame || !chessGameRef.current) return;

    chessGameRef.current.reset();
    // Ensure moves is an array and skip the initial position entry
    const moves = Array.isArray(selectedGame.moves) ? selectedGame.moves : [];
    console.log("Moves: ", moves); // Keep this for debugging if needed

    // Reset the board to the initial state before replaying moves
    chessGameRef.current.reset();

    // Replay moves up to the current index
    // Start from i = 1 because moves[0] is the initial position without a 'move' property
    for (let i = 1; i < currentMoveIndex + 1 && i < moves.length; i++) {
      // Check if the move object and SAN string exist
      if (moves[i] && moves[i].move && moves[i].move.san) {
        try {
          // Use the SAN string for the move
          chessGameRef.current.move(moves[i].move.san, { sloppy: true });
        } catch (error) {
          // Log error if a move fails during replay
          console.error(
            `Error replaying move #${i} (${moves[i].move.san}):`,
            error
          );
          // Optional: break the loop if a move fails to prevent further errors
          // break;
        }
      } else {
        // Log if a move entry is malformed
        console.warn(`Skipping malformed move entry at index ${i}:`, moves[i]);
      }
    }
    // Update the board position state after replaying moves
    setBoardPosition(chessGameRef.current.fen());
  }, [currentMoveIndex, selectedGame]);

  // Prepare a Chess.js instance for preview
  const reviewGame = useMemo(() => {
    if (!boardPosition) return null;
    const g = new Chess();
    g.load(boardPosition);
    return g;
  }, [boardPosition]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle game selection: if summary (no moves array), fetch full details
  const handleGameSelect = async (game) => {
    // 1) pull the *normalized* record back from your service
    const fullGame = await getGameHistoryById(game.id);
    if (!fullGame) return;

    // 2) if it still came back as a JSON‐string of moves, rebuild it in place
    if (typeof fullGame.moves === "string") {
      try {
        fullGame.moves = reconstructGameFromHistory(fullGame.moves);
      } catch (err) {
        console.error("Error reconstructing moves:", err);
        fullGame.moves = [];
      }
    }

    // 3) now setSelectedGame on the fully normalized object
    setSelectedGame(fullGame);
  };

  // Export PGN of selected game
  const exportPGN = () => {
    if (selectedGame) {
      const pgn = getGamePGN(selectedGame);
      const blob = new Blob([pgn], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chess-game-${new Date(selectedGame.played_at)
        .toISOString()
        .slice(0, 10)}.pgn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exportGIF = async () => {
    if (!selectedGame || !selectedGame.moves || gifExporting) return;

    setGifExporting(true); // Indicate loading
    console.log("Starting GIF export...");

    const boardSize = 860; // Width of the board
    const moveDisplayHeight = 150; // Approximate height of the move display box + some padding
    const totalHeight = boardSize + moveDisplayHeight;
    const delay = 500; // Delay between frames in ms

    // Create a hidden container for rendering frames
    const hiddenContainer = document.createElement('div');
    hiddenContainer.id = 'gif-render-container';
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px'; // Keep it off-screen
    hiddenContainer.style.width = `${boardSize}px`;
    // Set height to accommodate both board and move display
    // hiddenContainer.style.height = `${totalHeight}px`; // Height set by content is usually better
    document.body.appendChild(hiddenContainer);

    try {
      const chess = new Chess(); // Use a fresh instance for logical game state
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: boardSize, // Use board width
        height: totalHeight, // Use combined height
        workerScript: '/gif.worker.js'
      });

      // Function to render board + move display and add frame
      const addFrameForMove = async (fen, moveIndex) => { // Pass moveIndex to get correct move data
        const tempGame = new Chess(fen);

        // Get move data for the current frame
        let moveDataForDisplay = null;
        let moveNumberForDisplay = 'Start';
        let playerForDisplay = '';
        let sanForDisplay = 'Initial Position';
        let timeForDisplay = null;

        if (moveIndex > 0 && moveIndex <= selectedGame.moves.length) {
            moveDataForDisplay = selectedGame.moves[moveIndex - 1]; // Adjust index
            if (moveDataForDisplay && moveDataForDisplay.move) {
                moveNumberForDisplay = Math.ceil(moveIndex / 2);
                playerForDisplay = moveDataForDisplay.playerColor === 'w' ? 'White' : 'Black';
                // Use formatMoveDescription for GIF/MP4
                sanForDisplay = formatMoveDescription(moveDataForDisplay.move);
                timeForDisplay = moveDataForDisplay.timeSpent?.toFixed(1);
            } else {
                 sanForDisplay = 'Loading...'; // Fallback if data is missing
            }
        }

        // Render Move Display + ChessBoard component into the hidden container for GIF
        await new Promise(resolve => {
            const playerColorFull = selectedGame.player_color === 'w' ? 'White' : 'Black';
            const opponentColorFull = selectedGame.player_color === 'w' ? 'Black' : 'White';
            const gameResultText = isWin(selectedGame.result) ? `User Won on ${selectedGame.moves.length -1} move` : isLoss(selectedGame.result) ? `Computer Won on ${selectedGame.moves.length -1} move` : 'Draw';
            const resultColor = isWin(selectedGame.result) ? '#4CAF50' : isLoss(selectedGame.result) ? '#f44336' : '#ff9800'; // Green for win, Red for loss, Orange for draw

            ReactDOM.render(
                <div style={{ width: boardSize, backgroundColor: '#f0f0f0' /* Optional background */ }}>
                    {/* Replicated & Redesigned Current Move Display Structure for GIF */}
                    <div className="current-move-display" style={{ border: '1px solid #ccc', padding: '10px', background: '#f9f9f9', borderRadius: '5px', boxSizing: 'border-box', fontFamily: 'sans-serif', fontSize: '14px' }}>
                        {/* Top Row: Player Info & Logo */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee' }}>
                            <span style={{ fontWeight: 'bold' }}>User ({playerColorFull}) Vs. Computer ({opponentColorFull})</span>
                            <img src={logo} alt="Logo" style={{ height: '30px' }} />
                        </div>
                        {/* Bottom Row: Move, Result, Score */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* Current Move Info */}
                            <div style={{ flexGrow: 1, marginRight: '10px' }}>
                                {moveIndex > 0 && moveDataForDisplay ? (
                                    <span style={{ backgroundColor: '#007bff', color: 'white', padding: '3px 8px', borderRadius: '4px', marginRight: '10px' }}>
                                        {/* Display formatted move description in GIF/MP4 */}
                                        {moveNumberForDisplay}. {playerForDisplay}: {sanForDisplay} {timeForDisplay ? `(${timeForDisplay}s)` : ''}
                                    </span>
                                ) : (
                                    <span style={{ fontStyle: 'italic' }}>Initial Position</span>
                                )}
                            </div>
                            {/* Result Badge */}
                            <span style={{ backgroundColor: resultColor, color: 'white', padding: '3px 8px', borderRadius: '4px', marginRight: '10px', fontWeight: 'bold' }}>
                                {gameResultText}
                            </span>
                            {/* Score */}
  <span style={{ fontWeight: 'bold' }}>
    Score: {typeof selectedGame.finalScore === 'number'
      ? selectedGame.finalScore.toFixed(1)
      : 'N/A'}
  </span>
                        </div>
                    </div>
                    {/* ChessBoard */}
                    <ChessBoard
                        game={tempGame}
                        boardOrientation={selectedGame.player_color === "w" ? "white" : "black"}
                        boardWidth={boardSize}
                        isReplayMode={true}
                        onDrop={() => false}
                        moveFrom={""}
                        setMoveFrom={() => {}}
                        rightClickedSquares={{}}
                        setRightClickedSquares={() => {}}
                        moveSquares={{}}
                        setMoveSquares={() => {}}
                        playerColor={selectedGame.player_color}
                        activeTimer={null}
                        setMoveCompleted={() => {}}
                        setTimerButtonColor={() => {}}
                        previousGameStateRef={{ current: null }}
                        evaluateMove={() => {}}
                        updateGameStatus={() => {}}
                    />
                </div>,
                hiddenContainer,
                resolve
            );
        });

        // Slight delay to ensure rendering completes before capture
        await new Promise(resolve => setTimeout(resolve, 50));

        // Capture the entire hidden container (move display + board)
        const canvas = await html2canvas(hiddenContainer, { width: boardSize, height: totalHeight, windowHeight: totalHeight + 50 /* Ensure full capture */ });
        gif.addFrame(canvas, { delay: delay });
        console.log(`Added frame for move index ${moveIndex}, FEN: ${fen}`);
      };

      // --- Frame Generation ---
      // 1. Add initial position frame (moveIndex 0)
      console.log("Adding initial frame...");
      await addFrameForMove(chess.fen(), 0); // Pass 0 for initial state

      // 2. Add frames for each subsequent move
      const moves = Array.isArray(selectedGame.moves) ? selectedGame.moves : [];
      // Assuming moves[0] is initial state, actual moves start from index 1 in the array
      // The loop index `i` corresponds to the move number in the game (1-based)
      // The move data is at `moves[i]`
      for (let i = 1; i < moves.length; i++) { // Iterate through the actual moves
        const moveData = moves[i];
        if (moveData && moveData.move && moveData.move.san) {
          try {
            const moveResult = chess.move(moveData.move.san, { sloppy: true }); // Apply the move
            if (moveResult) {
              console.log(`Adding frame for move ${i}: ${moveData.move.san}`);
              await addFrameForMove(chess.fen(), i); // Pass current FEN and move index (i)
            } else {
               console.warn(`Skipping invalid move at index ${i}: ${moveData.move.san}`); // chess.js rejected the move
            }
          } catch (error) {
            console.error(`Error processing move ${i} (${moveData.move.san}):`, error);
            // Decide whether to continue or stop on error
          }
        } else {
           console.warn(`Skipping malformed move entry at index ${i}:`, moveData);
        }
      }

      // --- Finalize GIF ---
      gif.on('finished', (blob) => {
        console.log("GIF rendering finished.");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chess-game-${new Date(selectedGame.played_at).toISOString().slice(0, 10)}.gif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Clean up
        ReactDOM.unmountComponentAtNode(hiddenContainer); // Unmount React component
        document.body.removeChild(hiddenContainer); // Remove hidden div
        setGifExporting(false); // Reset loading state
      });

      gif.on('progress', (p) => {
         console.log(`GIF rendering progress: ${Math.round(p * 100)}%`);
         // Optionally update UI with progress
      });

      console.log("Starting GIF render process...");
      gif.render();

    } catch (error) {
      console.error("Error generating GIF:", error);
      // Clean up in case of error
      if (document.getElementById('gif-render-container')) {
         ReactDOM.unmountComponentAtNode(hiddenContainer);
         document.body.removeChild(hiddenContainer);
      }
      setGifExporting(false); // Reset loading state
      alert("Failed to generate GIF. Check console for details."); // User feedback
    }
  };

  // Export MP4 function
  const exportMP4 = async () => {
    if (!selectedGame || !selectedGame.moves || mp4Exporting) return;

    setMp4Exporting(true);
    console.log("Starting MP4 export...");

    const boardSize = 860; // Match GIF export width
    const moveDisplayHeight = 150; // Match GIF export height
    const totalHeight = boardSize + moveDisplayHeight;
    const frameRate = 2; // Frames per second (adjust as needed, e.g., 2 for 500ms delay)
    const frameDelay = 1000 / frameRate; // Delay between frames in ms

    // Create hidden container and canvas for rendering/recording
    const hiddenContainer = document.createElement('div');
    hiddenContainer.id = 'mp4-render-container';
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.width = `${boardSize}px`;
    document.body.appendChild(hiddenContainer);

    const recordingCanvas = document.createElement('canvas');
    recordingCanvas.width = boardSize;
    recordingCanvas.height = totalHeight;
    const ctx = recordingCanvas.getContext('2d');
    if (!ctx) {
        console.error("Could not get 2D context for recording canvas");
        setMp4Exporting(false);
        document.body.removeChild(hiddenContainer);
        alert("Failed to initialize canvas for MP4 export.");
        return;
    }

    // MediaRecorder setup
    let recorder;
    const recordedChunks = [];
    try {
        const stream = recordingCanvas.captureStream(frameRate);
        // Prefer webm/vp9 if available, fallback as needed
        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} not supported, trying default.`);
            options.mimeType = 'video/webm'; // Default webm
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.error("No suitable video/webm mimeType supported.");
                throw new Error("MediaRecorder MIME type not supported");
            }
        }
        recorder = new MediaRecorder(stream, options);

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log(`Recorded chunk size: ${event.data.size}`);
            }
        };

        recorder.onstop = () => {
            console.log("MediaRecorder stopped. Processing blob...");
            const blob = new Blob(recordedChunks, { type: options.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `chess-game-${new Date(selectedGame.played_at).toISOString().slice(0, 10)}.webm`; // Use .webm extension
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Clean up
            ReactDOM.unmountComponentAtNode(hiddenContainer);
            document.body.removeChild(hiddenContainer);
            setMp4Exporting(false);
            console.log("MP4 export finished and cleaned up.");
        };

        recorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            alert(`MediaRecorder error: ${event.error.name}. Check console.`);
             // Clean up on error
            if (document.getElementById('mp4-render-container')) {
                ReactDOM.unmountComponentAtNode(hiddenContainer);
                document.body.removeChild(hiddenContainer);
            }
            setMp4Exporting(false);
        };

    } catch (error) {
        console.error("Error setting up MediaRecorder:", error);
        setMp4Exporting(false);
        document.body.removeChild(hiddenContainer);
        alert("Failed to set up video recorder. Check console for details.");
        return;
    }

    // --- Frame Rendering and Recording Logic ---
    try {
        const chess = new Chess(); // Fresh instance for logic

        // Function to render component to an intermediate canvas using html2canvas,
        // then draw that onto the main recording canvas.
        const renderAndDrawFrame = async (fen, moveIndex) => {
            const tempGame = new Chess(fen);
            let moveDataForDisplay = null;
            let moveNumberForDisplay = 'Start';
            let playerForDisplay = '';
            let sanForDisplay = 'Initial Position';
            let timeForDisplay = null;

            if (moveIndex > 0 && moveIndex <= selectedGame.moves.length) {
                moveDataForDisplay = selectedGame.moves[moveIndex - 1];
                if (moveDataForDisplay && moveDataForDisplay.move) {
                moveNumberForDisplay = Math.ceil(moveIndex / 2);
                playerForDisplay = moveDataForDisplay.playerColor === 'w' ? 'White' : 'Black';
                // Use formatMoveDescription for MP4
                sanForDisplay = formatMoveDescription(moveDataForDisplay.move);
                timeForDisplay = moveDataForDisplay.timeSpent?.toFixed(1);
            } else {
                sanForDisplay = 'Loading...';
            }
        }

            // Render React component into the hidden div for MP4
            await new Promise(resolve => {
                const playerColorFull = selectedGame.player_color === 'w' ? 'White' : 'Black';
                const opponentColorFull = selectedGame.player_color === 'w' ? 'Black' : 'White';
                const gameResultText = isWin(selectedGame.result) ? `User Won on ${selectedGame.moves.length -1} move` : isLoss(selectedGame.result) ? `Computer Won on ${selectedGame.moves.length -1} move` : 'Draw';
                const resultColor = isWin(selectedGame.result) ? '#4CAF50' : isLoss(selectedGame.result) ? '#f44336' : '#ff9800'; // Green for win, Red for loss, Orange for draw

                ReactDOM.render(
                    <div style={{ width: boardSize, backgroundColor: '#f0f0f0' }}>
                        {/* Replicated & Redesigned Current Move Display Structure for MP4 */}
                         <div className="current-move-display" style={{ border: '1px solid #ccc', padding: '10px', background: '#f9f9f9', borderRadius: '5px', boxSizing: 'border-box', fontFamily: 'sans-serif', fontSize: '14px' }}>
                            {/* Top Row: Player Info & Logo */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid #eee' }}>
                                <span style={{ fontWeight: 'bold' }}>User ({playerColorFull}) Vs. Computer ({opponentColorFull})</span>
                                <img src={logo} alt="Logo" style={{ height: '30px' }} />
                            </div>
                            {/* Bottom Row: Move, Result, Score */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* Current Move Info */}
                                <div style={{ flexGrow: 1, marginRight: '10px' }}>
                                    {moveIndex > 0 && moveDataForDisplay ? (
                                    <span style={{ backgroundColor: '#007bff', color: 'white', padding: '3px 8px', borderRadius: '4px', marginRight: '10px' }}>
                                        {/* Display formatted move description in MP4 */}
                                        {moveNumberForDisplay}. {playerForDisplay}: {sanForDisplay} {timeForDisplay ? `(${timeForDisplay}s)` : ''}
                                    </span>
                                ) : (
                                    <span style={{ fontStyle: 'italic' }}>Initial Position</span>
                                    )}
                                </div>
                                {/* Result Badge */}
                                <span style={{ backgroundColor: resultColor, color: 'white', padding: '3px 8px', borderRadius: '4px', marginRight: '10px', fontWeight: 'bold' }}>
                                    {gameResultText}
                                </span>
                                {/* Score */}
                                <span style={{ fontWeight: 'bold' }}>
                                    Score: {typeof selectedGame.finalScore === 'number'
      ? selectedGame.finalScore.toFixed(1)
      : 'N/A'}
                                </span>
                            </div>
                        </div>
                        {/* ChessBoard */}
                        <ChessBoard
                            game={tempGame}
                            boardOrientation={selectedGame.player_color === "w" ? "white" : "black"}
                            boardWidth={boardSize}
                            isReplayMode={true}
                            onDrop={() => false}
                            moveFrom={""}
                            setMoveFrom={() => {}}
                            rightClickedSquares={{}}
                            setRightClickedSquares={() => {}}
                            moveSquares={{}}
                            setMoveSquares={() => {}}
                            playerColor={selectedGame.player_color}
                            activeTimer={null}
                            setMoveCompleted={() => {}}
                            setTimerButtonColor={() => {}}
                            previousGameStateRef={{ current: null }}
                            evaluateMove={() => {}}
                            updateGameStatus={() => {}}
                        />
                    </div>,
                    hiddenContainer,
                    resolve
                );
            });

            // Capture the rendered component using html2canvas
            const frameCanvas = await html2canvas(hiddenContainer, {
                width: boardSize,
                height: totalHeight,
                windowHeight: totalHeight + 50, // Ensure full capture
                logging: false // Reduce console noise
            });

            // Draw the captured frame onto the recording canvas
            ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height); // Clear previous frame
            ctx.drawImage(frameCanvas, 0, 0);
            console.log(`Drew frame for move index ${moveIndex} onto recording canvas.`);

            // Give the browser a moment to process the draw before the next frame/step
            await new Promise(resolve => setTimeout(resolve, 20)); // Small delay
        };

        // Start recording
        recorder.start();
        console.log("MediaRecorder started.");

        // --- Generate and Record Frames ---
        console.log("Adding initial frame for MP4...");
        await renderAndDrawFrame(chess.fen(), 0);
        // Wait for frame duration before proceeding to next frame
        await new Promise(resolve => setTimeout(resolve, frameDelay));

        const moves = Array.isArray(selectedGame.moves) ? selectedGame.moves : [];
        for (let i = 1; i < moves.length; i++) {
            const moveData = moves[i];
            if (moveData && moveData.move && moveData.move.san) {
                try {
                    const moveResult = chess.move(moveData.move.san, { sloppy: true });
                    if (moveResult) {
                        console.log(`Rendering frame for MP4 move ${i}: ${moveData.move.san}`);
                        await renderAndDrawFrame(chess.fen(), i);
                        // Wait for frame duration
                        await new Promise(resolve => setTimeout(resolve, frameDelay));
                    } else {
                        console.warn(`Skipping invalid move for MP4 at index ${i}: ${moveData.move.san}`);
                    }
                } catch (error) {
                    console.error(`Error processing move for MP4 ${i} (${moveData.move.san}):`, error);
                }
            } else {
                console.warn(`Skipping malformed move entry for MP4 at index ${i}:`, moveData);
            }
        }

        // Stop recording after the last frame has been processed and its delay passed
        console.log("Stopping MediaRecorder...");
        recorder.stop();

    } catch (error) {
        console.error("Error during MP4 frame generation/recording:", error);
        if (recorder && recorder.state === "recording") {
            recorder.stop(); // Attempt to stop recorder if it's running
        }
        // Clean up on error
        if (document.getElementById('mp4-render-container')) {
            ReactDOM.unmountComponentAtNode(hiddenContainer);
            document.body.removeChild(hiddenContainer);
        }
        setMp4Exporting(false);
        alert("Failed to generate MP4. Check console for details.");
    }
  };


  // Clear all filters
  const clearFilters = () => {
    setFilters({
      playerColor: "",
      result: "",
      level: "",
    });
  };

  // Navigation controls for move review
  const goToStart = () => {
    pauseMoves();
    setCurrentMoveIndex(0);
  };
  const goToEnd = () => {
    pauseMoves();
    if (selectedGame) {
      const moves = Array.isArray(selectedGame.moves) ? selectedGame.moves : [];
      setCurrentMoveIndex(moves.length);
    }
  };
  const goToPrevMove = () => {
    pauseMoves();
    setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
  };
  const goToNextMove = () => {
    pauseMoves();
    if (selectedGame) {
      const moves = Array.isArray(selectedGame.moves) ? selectedGame.moves : [];
      setCurrentMoveIndex((prev) => Math.min(moves.length, prev + 1));
    }
  };

  // Play/Pause functionality for continuous review with 0.5 sec interval
  const playMoves = () => {
    if (!selectedGame) return;
    setIsPlaying(true);
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    playTimerRef.current = setInterval(() => {
      setCurrentMoveIndex((prev) => {
        const moves = Array.isArray(selectedGame.moves)
          ? selectedGame.moves
          : [];
        if (prev < moves.length) {
          return prev + 1;
        } else {
          pauseMoves();
          return prev;
        }
      });
    }, 500);
  };

  const pauseMoves = () => {
    setIsPlaying(false);
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading game history...</div>;
  }

  return (
    <div className="game-history-container p-3 sm:p-4 lg:p-6 xl:p-8 min-h-screen text-white">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6">Game History</h2>
      <div className="filters bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-3 lg:p-4 mb-4 lg:mb-6">
        <h3 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4">Filters</h3>
        <div className="filter-controls grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="filter-group">
            <label className="block text-sm font-medium mb-1">Player Color</label>
            <select
              name="playerColor"
              value={filters.playerColor}
              onChange={handleFilterChange}
              className="w-full bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400 py-2 px-3 text-sm"
            >
              <option value="">All</option>
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="block text-sm font-medium mb-1">Result</label>
            <select
              name="result"
              value={filters.result}
              onChange={handleFilterChange}
              className="w-full bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400 py-2 px-3 text-sm"
            >
              <option value="">All</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="Draw">Draw</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="block text-sm font-medium mb-1">Computer Level</label>
            <select
              name="level"
              value={filters.level}
              onChange={handleFilterChange}
              className="w-full bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400 py-2 px-3 text-sm"
            >
              <option value="">All</option>
              <option value="1">Easy</option>
              <option value="2">Medium</option>
              <option value="3">Hard</option>
            </select>
          </div>
          <button onClick={clearFilters} className="bg-gray-700 hover:bg-gray-600 transition-colors duration-300 px-4 py-2 rounded-lg self-end text-sm">Clear Filters</button>
        </div>
      </div>

      <div className="game-history-content flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="game-list-container lg:w-1/3 xl:w-1/4 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-3 lg:p-4 overflow-y-auto max-h-96 lg:max-h-full">
          <h3 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4">Games ({filteredHistories.length})</h3>
          {filteredHistories.length === 0 ? (
            <p className="text-center text-gray-400">No games found.</p>
          ) : (
            <ul className="space-y-2">
              {filteredHistories.map((game, index) => {
                const summary = extractGameSummary(game);
                return (
                  <li
                    key={index}
                    className={`p-2 lg:p-3 rounded-lg cursor-pointer transition-colors duration-200 ${selectedGame && selectedGame.id === game.id ? "bg-primary-600" : "bg-white/10 hover:bg-white/20"}`}
                    onClick={() => handleGameSelect(game)}
                  >
                    <div className="game-summary">
                      <div className="flex justify-between items-center mb-1">
                        <div className="game-date text-xs lg:text-sm text-gray-300">{summary.date}</div>
                        <div className={`game-result font-bold text-xs lg:text-sm ${summary.result === 'Won' ? 'text-success' : summary.result === 'Lost' ? 'text-error' : 'text-warning'}`}>{summary.result}</div>
                      </div>
                      <div className="text-xs lg:text-sm text-gray-400">
                        <div className="flex flex-wrap gap-1 lg:gap-2">
                          <span>{summary.playerColor}</span>
                          <span>Lvl: {summary.computerLevel}</span>
                          <span>Moves: {summary.moveCount}</span>
                          <span>Score: {summary.finalScore}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="game-review-panel flex-1 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-3 lg:p-4">
          {selectedGame ? (
            <div className="flex flex-col h-full">
              <div className="review-top-section flex-1">
                <div className="board-and-move-display-area w-full max-w-md mx-auto mb-4 lg:mb-0 lg:mx-auto lg:max-w-md">
                  <div className="current-move-display bg-gray-900/50 rounded-lg p-2 mb-2 text-center">
                    {/* Move display content here */}
                  </div>
                  <div className="board-container">
                    {boardPosition && (
                      <ChessBoard
                        game={reviewGame}
                        boardOrientation={selectedGame.player_color === "w" ? "white" : "black"}
                        isReplayMode={true}
                        onDrop={() => false}
                        moveFrom={""}
                        setMoveFrom={() => {}}
                        rightClickedSquares={{}}
                        setRightClickedSquares={() => {}}
                        moveSquares={{}}
                        setMoveSquares={() => {}}
                        playerColor={selectedGame.player_color}
                        activeTimer={null}
                        setMoveCompleted={() => {}}
                        setTimerButtonColor={() => {}}
                        previousGameStateRef={{ current: null }}
                        evaluateMove={() => {}}
                        updateGameStatus={() => {}}
                      />
                    )}
                  </div>
                </div>
                <div className="game-metadata-area bg-gray-900/50 rounded-lg p-3 lg:p-4 mt-4">
                  <h4 className="text-base lg:text-lg font-bold mb-2 lg:mb-3">Game Info</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm lg:text-base">
                    <p><strong>Date:</strong> {new Date(selectedGame.played_at).toLocaleString()}</p>
                    <p><strong>Player Color:</strong> {selectedGame.player_color === "w" ? "White" : "Black"}</p>
                    <p><strong>Computer Level:</strong> {selectedGame.computer_level}</p>
                    <p><strong>Result:</strong> {getResultDisplayText(selectedGame.result)}</p>
                    <p><strong>Final Score:</strong> {typeof selectedGame.finalScore === 'number' ? selectedGame.finalScore.toFixed(1) : 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="review-controls flex flex-wrap justify-center items-center gap-2 p-2 lg:p-3 bg-gray-900/50 rounded-lg mt-4">
                <button onClick={goToStart} className="control-button text-base lg:text-lg px-2 py-1">⏮</button>
                <button onClick={goToPrevMove} className="control-button text-base lg:text-lg px-2 py-1">⏪</button>
                <button onClick={isPlaying ? pauseMoves : playMoves} className="control-button text-xl lg:text-2xl px-3 py-1">{isPlaying ? "❚❚" : "▶"}</button>
                <button onClick={goToNextMove} className="control-button text-base lg:text-lg px-2 py-1">⏩</button>
                <button onClick={goToEnd} className="control-button text-base lg:text-lg px-2 py-1">⏭</button>
                <button onClick={exportPGN} className="control-button text-xs lg:text-sm px-2 py-1">PGN</button>
                <button onClick={exportGIF} disabled={gifExporting} className="control-button text-xs lg:text-sm px-2 py-1">{gifExporting ? '...GIF' : 'GIF'}</button>
                <button onClick={exportMP4} disabled={mp4Exporting} className="control-button text-xs lg:text-sm px-2 py-1">{mp4Exporting ? '...MP4' : 'MP4'}</button>
              </div>
            </div>
          ) : (
            <div className="no-selection flex justify-center items-center h-full text-gray-400">
              <p>Select a game to review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHistory;
