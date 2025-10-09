import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const PresenceConfirmationDialog = ({
  open,
  onConfirm,
  onCloseTimeout,
  countdownSeconds = 10
}) => {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    console.log('[PresenceConfirmationDialog] Component open prop changed:', open);
    if (!open) {
      setSecondsLeft(countdownSeconds);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onCloseTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onCloseTimeout, countdownSeconds]);

  console.log('[PresenceConfirmationDialog] Rendering with open:', open, 'secondsLeft:', secondsLeft);

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      hideBackdrop={false}
      BackdropProps={{
        style: {
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9998
        }
      }}
      PaperProps={{
        style: {
          zIndex: 9999,
          backgroundColor: 'white',
          border: '2px solid #1976d2',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          position: 'relative'
        }
      }}
      sx={{
        zIndex: 9999,
        '& .MuiDialog-container': {
          zIndex: 9999
        }
      }}
    >
      <DialogContent>
        <Typography variant="h6" align="center" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
          Are you still there?
        </Typography>
        <Typography variant="body1" align="center" sx={{ mb: 2 }}>
          Please confirm you're active or the game will be paused in <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>{secondsLeft}</span> seconds.
        </Typography>
      </DialogContent>
      <DialogActions style={{ justifyContent: 'center', padding: '16px 24px' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={onConfirm}
          autoFocus
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0'
            },
            px: 3,
            py: 1
          }}
        >
          Yes, I'm here!
        </Button>
      </DialogActions>
    </Dialog>
  );
};

PresenceConfirmationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCloseTimeout: PropTypes.func.isRequired,
  countdownSeconds: PropTypes.number
};

export default PresenceConfirmationDialog;
