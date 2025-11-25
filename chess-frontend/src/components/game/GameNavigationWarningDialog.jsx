// src/components/game/GameNavigationWarningDialog.jsx
import React from 'react';
import { useGameNavigation } from '../../contexts/GameNavigationContext';

const GameNavigationWarningDialog = ({
  show,
  onPauseAndNavigate,
  onCancel,
  pendingNavigation
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
        <div className="text-center">
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-2">
            ⚠️ Active Chess Game in Progress
          </h3>

          <p className="text-gray-600 mb-4">
            You have an active chess game that hasn't been paused. To navigate to other pages, you must first pause the game to avoid:
          </p>

          <ul className="text-left text-gray-600 mb-6 space-y-2">
            <li className="flex items-start">
              <span className="text-yellow-500 mr-2">⏱️</span>
              <span>Losing time on your chess clock</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-500 mr-2">🔌</span>
              <span>Unfairly disconnecting from your opponent</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-500 mr-2">📊</span>
              <span>Potentially losing the game by abandonment</span>
            </li>
          </ul>

          {pendingNavigation && (
            <div className="bg-gray-50 rounded p-3 mb-6">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Destination:</span> {pendingNavigation}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={onPauseAndNavigate}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors font-medium"
            >
              ⏸️ Pause Game & Navigate
            </button>

            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
            >
              🔄 Stay in Game
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            💡 Tip: You can also use the Pause button in the game interface
          </p>
        </div>
      </div>
    </div>
  );
};

export const GameNavigationWarningDialogWrapper = () => {
  const { showWarningDialog, pauseGameAndNavigate, cancelNavigation, pendingNavigation } = useGameNavigation();

  return (
    <GameNavigationWarningDialog
      show={showWarningDialog}
      onPauseAndNavigate={pauseGameAndNavigate}
      onCancel={cancelNavigation}
      pendingNavigation={pendingNavigation}
    />
  );
};

export default GameNavigationWarningDialog;