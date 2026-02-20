// src/components/layout/Footer.js
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AboutContactModal from '../AboutContactModal';

/**
 * Footer component for consistent site-wide footer
 * Hidden on landing page (has its own footer)
 * Auto-hides on play pages in mobile landscape mode
 */
const Footer = () => {
  const location = useLocation();
  const footerRef = useRef(null);
  const [showAboutContact, setShowAboutContact] = useState(false);
  const navigate = useNavigate();
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

  // Hide footer entirely on play pages (game takes full focus)
  if (isPlayPage) return null;

  return (
    <>
      <footer
        ref={footerRef}
        className="bg-[#1a1a18] border-t border-[#3d3a37] text-white py-8 sm:py-12 mt-auto transition-all duration-300 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12">
          <div className="text-center">
            <div className="mb-4 sm:mb-6 p-4 bg-[#262421] rounded-lg">
              <p className="text-[#8b8987] text-xs sm:text-sm leading-relaxed">
                Chess99 is an educational, skill-based chess learning platform for kids. We do not offer real-money gaming, betting, or gambling in any form. All activities are designed for learning and safe competitive play.
              </p>
            </div>
            <p className="text-[#8b8987] text-xs sm:text-sm lg:text-base mb-4 sm:mb-6">© 2026 Chess99. Making Chess Fun for Kids!</p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
              <Link to="/coming-soon" className="text-[#8b8987] hover:text-[#81b64c] transition-colors text-xs sm:text-sm lg:text-base">Puzzles</Link>
              <Link to="/tutorial" className="text-[#8b8987] hover:text-[#81b64c] transition-colors text-xs sm:text-sm lg:text-base">
                Learn
              </Link>
              <button
                onClick={() => setShowAboutContact(true)}
                className="text-[#8b8987] hover:text-[#81b64c] transition-colors text-xs sm:text-sm lg:text-base"
              >
                About
              </button>
              <button
                onClick={() => setShowAboutContact(true)}
                className="text-[#8b8987] hover:text-[#81b64c] transition-colors text-xs sm:text-sm lg:text-base"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* About & Contact Modal */}
      <AboutContactModal
        isOpen={showAboutContact}
        onClose={() => setShowAboutContact(false)}
      />
    </>
  );
};

export default Footer;
