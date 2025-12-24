// src/components/game/DrawButton.jsx
import React, { useState } from 'react';
import { gameService } from '../../services/gameService';

/**
 * DrawButton Component
 * Handles draw offers in both computer and multiplayer games
 *
 * @param {Object} props
 * @param {number} props.gameId - The game ID
 * @param {string} props.gameMode - Game mode ('rated' or 'casual')
 * @param {boolean} props.isComputerGame - Whether this is a computer game
 * @param {Function} props.onDrawOffered - Callback when draw is offered
 * @param {Function} props.onDrawAccepted - Callback when draw is accepted
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {Object} props.drawStatus - Current draw status from API
 */
const DrawButton = ({
  gameId,
  gameMode = 'casual',
  isComputerGame = false,
  onDrawOffered,
  onDrawAccepted,
  disabled = false,
  drawStatus = null
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState(null);

  const handleDrawOffer = async () => {
    console.log('[DrawButton] 🎯 Draw offer initiated', { gameId, isComputerGame, gameMode });
    try {
      setLoading(true);
      setError(null);

      console.log('[DrawButton] 📡 Calling gameService.offerDraw...');
      const result = await gameService.offerDraw(gameId);
      console.log('[DrawButton] ✅ Draw offer result:', result);

      if (result.auto_accepted || result.status === 'accepted') {
        // Computer auto-accepted or opponent accepted
        console.log('[DrawButton] 🤖 Draw auto-accepted by computer');
        if (onDrawAccepted) {
          console.log('[DrawButton] 📞 Calling onDrawAccepted callback');
          onDrawAccepted(result);
        } else {
          console.warn('[DrawButton] ⚠️ onDrawAccepted callback not provided!');
        }
      } else {
        // Multiplayer - waiting for response
        console.log('[DrawButton] ⏳ Draw offer sent, waiting for opponent');
        if (onDrawOffered) {
          onDrawOffered(result);
        }
      }

      setShowConfirmation(false);
    } catch (err) {
      console.error('[DrawButton] ❌ Error offering draw:', err);
      console.error('[DrawButton] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.message || 'Failed to offer draw');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    console.log('[DrawButton] 🔵 Confirm button clicked');
    handleDrawOffer();
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setError(null);
  };

  // Show pending status if draw offer exists
  const isPending = drawStatus?.status === 'pending';

  return (
    <>
      {/* Draw Button */}
      <button
        onClick={handleButtonClick}
        disabled={disabled || loading || isPending}
        className={`
          px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
          ${disabled || loading || isPending
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gray-600 text-white hover:bg-gray-700 active:scale-95'
          }
          flex items-center gap-2
        `}
        title={isPending ? 'Draw offer pending' : 'Offer draw'}
      >
        <span>{loading ? '...' : isPending ? '⏳' : '🤝'}</span>
        <span>{isPending ? 'Draw Pending' : 'Offer Draw'}</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
            <div className="text-center">
              {/* Icon */}
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🤝</span>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Offer Draw?
              </h3>

              {/* Description based on game type */}
              <div className="text-gray-600 mb-4">
                {isComputerGame ? (
                  <div>
                    <p className="mb-2">
                      The computer will automatically evaluate the position and accept the draw.
                    </p>
                    {gameMode === 'rated' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                        <p className="text-sm text-yellow-800">
                          ⚠️ <strong>Rating Impact:</strong> The draw will affect your rating based on your position advantage.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="mb-2">
                      Your opponent will be notified and can accept or decline the draw offer.
                    </p>
                    {gameMode === 'rated' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                        <p className="text-sm text-yellow-800">
                          ⚠️ <strong>Rating Impact:</strong> If accepted, the draw will affect both players' ratings based on their performance.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Offering...' : 'Confirm Draw Offer'}
                </button>

                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DrawButton;
