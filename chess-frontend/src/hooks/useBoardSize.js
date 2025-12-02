import { useState, useEffect } from 'react';
import { BOARD_SIZES, BREAKPOINTS } from '../constants/tutorialConstants';

/**
 * Custom hook for responsive board sizing
 * Returns the appropriate board size based on window width
 */
const useBoardSize = () => {
  const [boardSize, setBoardSize] = useState(BOARD_SIZES.DEFAULT);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      if (width < BREAKPOINTS.MOBILE) {
        setBoardSize(BOARD_SIZES.MOBILE);
      } else if (width < BREAKPOINTS.TABLET) {
        setBoardSize(BOARD_SIZES.TABLET);
      } else {
        setBoardSize(BOARD_SIZES.DESKTOP);
      }
    };

    // Set initial size
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return boardSize;
};

export default useBoardSize;
