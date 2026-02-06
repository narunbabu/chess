/**
 * Hooks Index
 *
 * Central export point for all PlayMultiplayer hooks.
 * This allows for clean imports in components:
 *
 * import { useGameState, usePauseResume } from './hooks';
 *
 * @module hooks
 */

export { useGameState } from './useGameState';
export { usePauseResume } from './usePauseResume';
export { useWebSocketEvents } from './useWebSocketEvents';
export { useMoveValidation } from './useMoveValidation';

// Re-export default exports as well for flexibility
export { default as useGameStateDefault } from './useGameState';
export { default as usePauseResumeDefault } from './usePauseResume';
export { default as useWebSocketEventsDefault } from './useWebSocketEvents';
export { default as useMoveValidationDefault } from './useMoveValidation';
