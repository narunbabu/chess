// src/components/layout/Footer.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Footer component for consistent site-wide footer
 * Hidden on landing page (has its own footer)
 */
const Footer = () => {
  const location = useLocation();

  // Hide footer on landing page (has its own footer)
  if (location.pathname === '/') {
    return null;
  }

  return (
    <footer className="bg-gray-800 text-white py-2 sm:py-4 md:py-6 mt-auto">
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
