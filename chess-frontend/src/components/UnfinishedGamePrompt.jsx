import React from 'react';
import { Box, Typography, Button, Modal, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 500, md: 600 },
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: 2,
  p: 4,
};

/**
 * UnfinishedGamePrompt - Modal to prompt user about unfinished games
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.gameData - Unfinished game data
 * @param {Function} props.onResume - Resume game handler
 * @param {Function} props.onDiscard - Discard game handler
 */
const UnfinishedGamePrompt = ({ open, onClose, gameData, onResume, onDiscard }) => {
  const navigate = useNavigate();

  if (!gameData) return null;

  const handleResume = () => {
    if (onResume) {
      onResume(gameData);
    } else {
      // Default behavior: navigate to game page
      if (gameData.gameId) {
        // Backend game - navigate to multiplayer
        navigate(`/play/multiplayer/${gameData.gameId}`);
      } else if (gameData.gameMode === 'computer') {
        // Guest computer game - navigate to play page with state restoration
        navigate('/play', { state: { resumeGame: gameData } });
      }
    }
    onClose();
  };

  const handleDiscard = async () => {
    if (onDiscard) {
      await onDiscard(gameData);
    }
    onClose();
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getMoveCount = () => {
    if (gameData.moves && Array.isArray(gameData.moves)) {
      return gameData.moves.length;
    }
    if (gameData.pgn) {
      // Count moves from PGN
      const moves = gameData.pgn.match(/\d+\.\s/g);
      return moves ? moves.length : 0;
    }
    return 0;
  };

  const getGameTypeLabel = () => {
    if (gameData.gameMode === 'computer') {
      return `vs Computer (Level ${gameData.computerLevel || 1})`;
    }
    if (gameData.gameMode === 'multiplayer') {
      return `vs ${gameData.opponentName || 'Opponent'}`;
    }
    return 'Unknown';
  };

  const getTurnInfo = () => {
    const turn = gameData.turn === 'w' || gameData.turn === 'white' ? 'White' : 'Black';
    const isYourTurn =
      (turn === 'White' && gameData.playerColor === 'white') ||
      (turn === 'Black' && gameData.playerColor === 'black');

    return isYourTurn ? `Your turn (${turn})` : `Opponent's turn (${turn})`;
  };

  const getTimeInfo = () => {
    if (!gameData.timerState) return null;

    const whiteTime = Math.ceil(gameData.timerState.whiteMs / 60000);
    const blackTime = Math.ceil(gameData.timerState.blackMs / 60000);

    return `⏱️ ${whiteTime}:00 vs ${blackTime}:00`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="unfinished-game-title"
      aria-describedby="unfinished-game-description"
    >
      <Paper sx={modalStyle}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography id="unfinished-game-title" variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Unfinished Game Found
          </Typography>
          <CloseIcon
            sx={{ cursor: 'pointer', color: 'text.secondary' }}
            onClick={onClose}
          />
        </Box>

        {/* Game Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
            You have an unfinished game that you can resume:
          </Typography>

          <Box sx={{ bgcolor: 'background.default', borderRadius: 1, p: 2, mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Type:</strong> {getGameTypeLabel()}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Moves played:</strong> {getMoveCount()}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Turn:</strong> {getTurnInfo()}
            </Typography>
            {getTimeInfo() && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Time:</strong> {getTimeInfo()}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              Saved {formatTimestamp(gameData.timestamp)}
            </Typography>
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={handleResume}
            fullWidth
            sx={{ py: 1.5 }}
          >
            Resume Game
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDiscard}
            fullWidth
            sx={{ py: 1.5 }}
          >
            Discard & Start New
          </Button>
        </Box>

        {/* Help Text */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 2,
            color: 'text.secondary'
          }}
        >
          {gameData.source === 'localStorage'
            ? 'This game is saved locally on your device'
            : 'This game is saved in your account'
          }
        </Typography>
      </Paper>
    </Modal>
  );
};

export default UnfinishedGamePrompt;
