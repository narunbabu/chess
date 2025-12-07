// src/components/layout/Footer.js
import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Footer component for consistent site-wide footer
 * Hidden on landing page (has its own footer)
 * Auto-hides on play pages in mobile landscape mode
 */
const Footer = () => {
  const location = useLocation();
  const footerRef = useRef(null);
  const isPlayPage = location.pathname === '/play' || location.pathname.startsWith('/play/');

  useEffect(() => {
    // Only apply footer hiding logic on play pages in landscape mode on mobile
    if (!isPlayPage) return;

    const footer = footerRef.current;

    const checkLandscapeAndHide = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 812; // iPhone X width in landscape

      if (isLandscape && isMobile && footerRef.current) {
        // Immediately hide footer in mobile landscape mode
        footerRef.current.style.display = 'none';
        footerRef.current.style.visibility = 'hidden';
        footerRef.current.style.height = '0';
        footerRef.current.style.overflow = 'hidden';
      } else {
        // Not in landscape mobile mode, ensure footer is visible
        if (footerRef.current) {
          footerRef.current.style.display = '';
          footerRef.current.style.visibility = '';
          footerRef.current.style.height = '';
          footerRef.current.style.overflow = '';
        }
      }
    };

    // Check on mount
    checkLandscapeAndHide();

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkLandscapeAndHide);
    window.addEventListener('orientationchange', checkLandscapeAndHide);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkLandscapeAndHide);
      window.removeEventListener('orientationchange', checkLandscapeAndHide);
      // Restore footer visibility on cleanup
      if (footer) {
        footer.style.display = '';
        footer.style.visibility = '';
        footer.style.height = '';
        footer.style.overflow = '';
      }
    };
  }, [isPlayPage, location.pathname]);

  // Hide footer on landing page (has its own footer)
  if (location.pathname === '/') {
    return null;
  }

  return (
    <footer
      ref={footerRef}
      className="bg-gray-800 text-white py-2 sm:py-4 md:py-6 mt-auto transition-all duration-300 relative z-10"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-gray-400 text-xs sm:text-sm md:text-base">
            © 2024 Chess99. Making Chess Fun for Everyone!
          </p>
          <div className="mt-1 sm:mt-2 flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4">
            <Link to="/puzzles" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm md:text-base">
              Puzzles
            </Link>
            <Link to="/learn" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm md:text-base">
              Learn
            </Link>
            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm md:text-base">
              Dashboard
            </Link>
            <button className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm md:text-base">
              About
            </button>
            <button className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm md:text-base">
              Contact
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
