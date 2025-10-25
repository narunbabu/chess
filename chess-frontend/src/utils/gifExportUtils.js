// Utility functions for exporting chess games as GIF
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import GIF from 'gif.js';
import { Chess } from 'chess.js';

/**
 * Generate a GIF from a chess game
 * @param {object} gameData - Game data with moves, player info, etc.
 * @param {React.Component} ChessBoardComponent - Chess board component to render
 * @param {object} options - Additional options
 * @returns {Promise<Blob>} GIF blob
 */
export const generateGameGIF = async (gameData, ChessBoardComponent, options = {}) => {
  const {
    boardSize = 860,
    delay = 500,
    quality = 10,
    workers = 2,
    onProgress = null,
    includeEndCard = false,
    endCardComponent = null
  } = options;

  const moveDisplayHeight = 150;
  const totalHeight = boardSize + moveDisplayHeight;

  // Create a hidden container for rendering frames
  const hiddenContainer = document.createElement('div');
  hiddenContainer.id = 'gif-render-container';
  hiddenContainer.style.position = 'absolute';
  hiddenContainer.style.left = '-9999px';
  hiddenContainer.style.width = `${boardSize}px`;
  document.body.appendChild(hiddenContainer);

  try {
    const chess = new Chess();
    const gif = new GIF({
      workers,
      quality,
      width: boardSize,
      height: totalHeight,
      workerScript: '/gif.worker.js'
    });

    // Function to render board frame
    const addFrameForMove = async (fen, moveIndex, moveData = null) => {
      const tempGame = new Chess(fen);

      // Prepare move display data
      let moveInfo = {
        moveNumber: 'Start',
        player: '',
        san: 'Initial Position',
        time: null
      };

      if (moveIndex > 0 && moveData) {
        moveInfo = {
          moveNumber: Math.ceil(moveIndex / 2),
          player: moveData.playerColor === 'w' ? 'White' : 'Black',
          san: moveData.move?.san || moveData.san || 'Unknown',
          time: moveData.timeSpent?.toFixed(1)
        };
      }

      // Render component
      await new Promise(resolve => {
        const playerColorFull = gameData.playerColor === 'w' ? 'White' : 'Black';
        const opponentName = gameData.opponentName || (gameData.isMultiplayer ? 'Opponent' : 'Computer');

        ReactDOM.render(
          <div style={{ width: boardSize, backgroundColor: '#f0f0f0' }}>
            {/* Move display */}
            <div style={{
              border: '1px solid #ccc',
              padding: '10px',
              background: '#f9f9f9',
              borderRadius: '5px',
              fontFamily: 'sans-serif',
              fontSize: '14px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                paddingBottom: '5px',
                borderBottom: '1px solid #eee'
              }}>
                <span style={{ fontWeight: 'bold' }}>
                  {gameData.playerName || 'Player'} ({playerColorFull}) vs {opponentName}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ flexGrow: 1 }}>
                  {moveIndex > 0 && moveData ? (
                    <span style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {moveInfo.moveNumber}. {moveInfo.player}: {moveInfo.san}
                      {moveInfo.time ? ` (${moveInfo.time}s)` : ''}
                    </span>
                  ) : (
                    <span style={{ fontStyle: 'italic' }}>Initial Position</span>
                  )}
                </div>
              </div>
            </div>

            {/* Chess board */}
            <ChessBoardComponent
              game={tempGame}
              boardOrientation={gameData.playerColor === 'w' ? 'white' : 'black'}
              boardWidth={boardSize}
              isReplayMode={true}
              onDrop={() => false}
              moveFrom=""
              setMoveFrom={() => {}}
              rightClickedSquares={{}}
              setRightClickedSquares={() => {}}
              moveSquares={{}}
              setMoveSquares={() => {}}
              playerColor={gameData.playerColor}
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

      // Wait for render to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Capture frame
      const canvas = await html2canvas(hiddenContainer, {
        width: boardSize,
        height: totalHeight,
        windowHeight: totalHeight + 50
      });
      gif.addFrame(canvas, { delay });
    };

    // Add initial position frame
    await addFrameForMove(chess.fen(), 0);

    // Add frames for each move
    const moves = gameData.moves || [];
    for (let i = 0; i < moves.length; i++) {
      const moveData = moves[i];
      if (moveData && (moveData.move?.san || moveData.san)) {
        try {
          const san = moveData.move?.san || moveData.san;
          const moveResult = chess.move(san, { sloppy: true });
          if (moveResult) {
            await addFrameForMove(chess.fen(), i + 1, moveData);
          }
        } catch (error) {
          console.error(`Error processing move ${i}:`, error);
        }
      }
    }

    // Add end card if requested
    if (includeEndCard && endCardComponent) {
      await new Promise(resolve => {
        ReactDOM.render(endCardComponent, hiddenContainer, resolve);
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const canvas = await html2canvas(hiddenContainer, {
        width: boardSize,
        height: totalHeight
      });
      gif.addFrame(canvas, { delay: 2000 }); // Show end card for 2 seconds
    }

    // Generate GIF
    return new Promise((resolve, reject) => {
      gif.on('finished', (blob) => {
        // Clean up
        ReactDOM.unmountComponentAtNode(hiddenContainer);
        document.body.removeChild(hiddenContainer);
        resolve(blob);
      });

      gif.on('progress', (p) => {
        onProgress?.(p);
      });

      gif.on('error', (error) => {
        // Clean up on error
        if (document.getElementById('gif-render-container')) {
          ReactDOM.unmountComponentAtNode(hiddenContainer);
          document.body.removeChild(hiddenContainer);
        }
        reject(error);
      });

      gif.render();
    });
  } catch (error) {
    // Clean up on error
    if (document.getElementById('gif-render-container')) {
      ReactDOM.unmountComponentAtNode(hiddenContainer);
      document.body.removeChild(hiddenContainer);
    }
    throw error;
  }
};

/**
 * Generate a static image of the end card
 * @param {React.Element} endCardElement - End card component/element
 * @param {object} options - Additional options
 * @returns {Promise<Blob>} Image blob
 */
export const generateEndCardImage = async (endCardElement, options = {}) => {
  const {
    width = 600,
    height = 400
  } = options;

  // Create a hidden container
  const hiddenContainer = document.createElement('div');
  hiddenContainer.style.position = 'absolute';
  hiddenContainer.style.left = '-9999px';
  hiddenContainer.style.width = `${width}px`;
  hiddenContainer.style.height = `${height}px`;
  document.body.appendChild(hiddenContainer);

  try {
    // Render the end card
    await new Promise(resolve => {
      ReactDOM.render(endCardElement, hiddenContainer, resolve);
    });

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture as canvas
    const canvas = await html2canvas(hiddenContainer, { width, height });

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        // Clean up
        ReactDOM.unmountComponentAtNode(hiddenContainer);
        document.body.removeChild(hiddenContainer);

        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    });
  } catch (error) {
    // Clean up on error
    if (hiddenContainer.parentNode) {
      ReactDOM.unmountComponentAtNode(hiddenContainer);
      document.body.removeChild(hiddenContainer);
    }
    throw error;
  }
};

/**
 * Download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
