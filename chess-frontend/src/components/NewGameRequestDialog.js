// src/components/NewGameRequestDialog.js
import React from 'react';
import { getPlayerAvatar } from '../utils/playerDisplayUtils';
import './NewGameRequestDialog.css';

const NewGameRequestDialog = ({ request, onAccept, onDecline }) => {
  if (!request) return null;

  // Determine color preference text
  const getColorPreferenceText = () => {
    if (!request.color_preference) return null;

    if (request.color_preference === 'random') {
      return 'Random colors will be assigned';
    }

    // Find who is the requester
    const isRequesterWhite = request.new_game.white_player.id === request.requester_id;
    const requesterColor = isRequesterWhite ? 'white' : 'black';
    const receiverColor = isRequesterWhite ? 'black' : 'white';

    return `${request.new_game[`${requesterColor}_player`].name} requested ${request.color_preference}, you will play as ${receiverColor}`;
  };

  return (
    <div className="new-game-request-overlay">
      <div className="new-game-request-dialog">
        <div className="new-game-request-icon">
          🎮
        </div>
        <h2 className="new-game-request-title">
          New Game Challenge
        </h2>
        <p className="new-game-request-message">
          {request.message}
        </p>
        <div className="new-game-request-details">
          {request.color_preference && (
            <p className="color-preference-note">
              {getColorPreferenceText()}
            </p>
          )}
          <div className="player-matchup">
            <div className="player">
              <img
                src={
                  getPlayerAvatar(request.new_game.white_player) ||
                  `https://i.pravatar.cc/150?u=${request.new_game.white_player.email || `user${request.new_game.white_player.id}`}`
                }
                alt={request.new_game.white_player.name}
                className="player-avatar"
              />
              <span className="player-name">{request.new_game.white_player.name}</span>
              <span className="player-rating">({request.new_game.white_player.rating})</span>
            </div>
            <span className="vs">VS</span>
            <div className="player">
              <img
                src={
                  getPlayerAvatar(request.new_game.black_player) ||
                  `https://i.pravatar.cc/150?u=${request.new_game.black_player.email || `user${request.new_game.black_player.id}`}`
                }
                alt={request.new_game.black_player.name}
                className="player-avatar"
              />
              <span className="player-name">{request.new_game.black_player.name}</span>
              <span className="player-rating">({request.new_game.black_player.rating})</span>
            </div>
          </div>
        </div>
        <div className="new-game-request-actions">
          <button onClick={onAccept} className="btn btn-accept">
            Accept
          </button>
          <button onClick={onDecline} className="btn btn-decline">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGameRequestDialog;
