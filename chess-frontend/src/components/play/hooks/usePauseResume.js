/**
 * usePauseResume Hook
 *
 * Manages pause/resume state and logic for multiplayer games.
 * Handles inactivity detection, resume requests, cooldowns, and countdown timers.
 *
 * @module usePauseResume
 */

import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing pause/resume state in multiplayer games
 *
 * @returns {Object} Pause/resume state and management functions
 */
export const usePauseResume = () => {
  // Inactivity detection state
  const [showPresenceDialog, setShowPresenceDialog] = useState(false);
  const [showPausedGame, setShowPausedGame] = useState(false);
  const [pausedByUserName, setPausedByUserName] = useState(null);

  // Resume request state
  const [resumeRequestData, setResumeRequestData] = useState(null);
  const [resumeRequestCountdown, setResumeRequestCountdown] = useState(0);
  const [isWaitingForResumeResponse, setIsWaitingForResumeResponse] = useState(false);
  const [isLobbyResume, setIsLobbyResume] = useState(false);
  const [shouldAutoSendResume, setShouldAutoSendResume] = useState(false);

  // Cooldown state
  const [lastManualResumeRequestTime, setLastManualResumeRequestTime] = useState(null);
  const [resumeCooldownRemaining, setResumeCooldownRemaining] = useState(0);
  const RESUME_COOLDOWN_SECONDS = 60;

  // Refs for stable tracking
  const lastActivityTimeRef = useRef(Date.now());
  const enabledRef = useRef(true);
  const gameActiveRef = useRef(false);
  const showPresenceDialogRef = useRef(false);
  const inactivityCheckIntervalRef = useRef(null);
  const isPausingRef = useRef(false);
  const resumeRequestTimer = useRef(null);
  const countdownRef = useRef(0);
  const hasAutoRequestedResume = useRef(false);
  const hasReceivedResumeRequest = useRef(false);
  const isReadyForAutoSend = useRef(false);
  const isPausedForNavigationRef = useRef(false);

  /**
   * Update activity timestamp
   */
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityTimeRef.current = now;

    if (showPresenceDialogRef.current) {
      setShowPresenceDialog(false);
      showPresenceDialogRef.current = false;
    }
  }, []);

  /**
   * Start resume request countdown timer
   */
  const startResumeCountdown = useCallback((seconds) => {
    // Clear any existing countdown
    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
      resumeRequestTimer.current = null;
    }

    countdownRef.current = seconds;
    setResumeRequestCountdown(seconds);

    resumeRequestTimer.current = setInterval(() => {
      countdownRef.current -= 1;
      setResumeRequestCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        clearInterval(resumeRequestTimer.current);
        resumeRequestTimer.current = null;
        setResumeRequestData(null);
        setIsWaitingForResumeResponse(false);
      }
    }, 1000);
  }, []);

  /**
   * Clear resume request state
   */
  const clearResumeRequest = useCallback(() => {
    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
      resumeRequestTimer.current = null;
    }
    setResumeRequestData(null);
    setIsWaitingForResumeResponse(false);
    setResumeRequestCountdown(0);
    hasReceivedResumeRequest.current = false;
    hasAutoRequestedResume.current = false;
  }, []);

  /**
   * Clear cooldown state
   */
  const clearCooldown = useCallback(() => {
    setLastManualResumeRequestTime(null);
    setResumeCooldownRemaining(0);
  }, []);

  /**
   * Check if cooldown is active
   */
  const isCooldownActive = useCallback(() => {
    if (!lastManualResumeRequestTime) return false;
    const elapsed = Date.now() - lastManualResumeRequestTime;
    return elapsed < RESUME_COOLDOWN_SECONDS * 1000;
  }, [lastManualResumeRequestTime, RESUME_COOLDOWN_SECONDS]);

  /**
   * Get remaining cooldown time in seconds
   */
  const getRemainingCooldown = useCallback(() => {
    if (!lastManualResumeRequestTime) return 0;
    const elapsed = Date.now() - lastManualResumeRequestTime;
    const remaining = Math.ceil((RESUME_COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
    return Math.max(0, remaining);
  }, [lastManualResumeRequestTime, RESUME_COOLDOWN_SECONDS]);

  /**
   * Handle game paused event
   */
  const handlePaused = useCallback((pausedByName) => {
    setPausedByUserName(pausedByName);
    setShowPausedGame(true);
    setShowPresenceDialog(false);
    showPresenceDialogRef.current = false;
    clearResumeRequest();
    clearCooldown();
  }, [clearResumeRequest, clearCooldown]);

  /**
   * Handle game resumed event
   */
  const handleResumed = useCallback(() => {
    setShowPausedGame(false);
    setPausedByUserName(null);
    setShowPresenceDialog(false);
    showPresenceDialogRef.current = false;
    clearResumeRequest();
    clearCooldown();
    setIsLobbyResume(false);
    lastActivityTimeRef.current = Date.now();
  }, [clearResumeRequest, clearCooldown]);

  /**
   * Reset all pause/resume state
   */
  const resetPauseResumeState = useCallback(() => {
    setShowPresenceDialog(false);
    setShowPausedGame(false);
    setPausedByUserName(null);
    clearResumeRequest();
    clearCooldown();
    setIsLobbyResume(false);
    setShouldAutoSendResume(false);
    lastActivityTimeRef.current = Date.now();
    enabledRef.current = true;
    gameActiveRef.current = false;
    showPresenceDialogRef.current = false;
    isPausingRef.current = false;
    hasAutoRequestedResume.current = false;
    hasReceivedResumeRequest.current = false;
    isReadyForAutoSend.current = false;
    isPausedForNavigationRef.current = false;

    if (inactivityCheckIntervalRef.current) {
      clearInterval(inactivityCheckIntervalRef.current);
      inactivityCheckIntervalRef.current = null;
    }
  }, [clearResumeRequest, clearCooldown]);

  return {
    // State
    showPresenceDialog,
    setShowPresenceDialog,
    showPausedGame,
    setShowPausedGame,
    pausedByUserName,
    setPausedByUserName,
    resumeRequestData,
    setResumeRequestData,
    resumeRequestCountdown,
    setResumeRequestCountdown,
    isWaitingForResumeResponse,
    setIsWaitingForResumeResponse,
    isLobbyResume,
    setIsLobbyResume,
    shouldAutoSendResume,
    setShouldAutoSendResume,
    lastManualResumeRequestTime,
    setLastManualResumeRequestTime,
    resumeCooldownRemaining,
    setResumeCooldownRemaining,
    RESUME_COOLDOWN_SECONDS,

    // Refs
    lastActivityTimeRef,
    enabledRef,
    gameActiveRef,
    showPresenceDialogRef,
    inactivityCheckIntervalRef,
    isPausingRef,
    resumeRequestTimer,
    countdownRef,
    hasAutoRequestedResume,
    hasReceivedResumeRequest,
    isReadyForAutoSend,
    isPausedForNavigationRef,

    // Functions
    updateActivity,
    startResumeCountdown,
    clearResumeRequest,
    clearCooldown,
    isCooldownActive,
    getRemainingCooldown,
    handlePaused,
    handleResumed,
    resetPauseResumeState,
  };
};

export default usePauseResume;
