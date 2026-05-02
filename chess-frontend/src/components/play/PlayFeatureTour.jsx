import React from 'react';
import GuidedTour from '../onboarding/GuidedTour';

/**
 * PlayFeatureTour - Guided tour for first casual game.
 * Uses GuidedTour component (same as lobby tour) to highlight and explain features.
 * Stores completion in localStorage.
 */
const PLAY_TOUR_STEPS = [
  {
    target: '[data-tour="action-undo"]',
    title: 'Undo Move',
    description: 'You can undo a move in casual games. You have limited chances based on difficulty.',
  },
  {
    target: '[data-tour="tab-cct"]',
    title: 'CCT Panel',
    description: 'Checks, Captures, Threats — see suggested moves and board arrows. Click to open the panel.',
  },
  {
    target: '[data-tour="tab-companion"]',
    title: 'Companion',
    description: 'Select a companion to play moves on your behalf. Try "Play One Move" or "Play Until Stopped".',
  },
  {
    target: '[data-tour="action-help"]',
    title: 'Help & Tour',
    description: 'Click this button anytime to relaunch this tour.',
  },
];

const PlayFeatureTour = ({
  open = false,
  onClose = () => {},
  storageKey = 'chess99_casual_play_tour_seen',
}) => {
  return (
    <GuidedTour
      steps={PLAY_TOUR_STEPS}
      isOpen={open}
      onClose={onClose}
      storageKey={storageKey}
    />
  );
};

export default PlayFeatureTour;
