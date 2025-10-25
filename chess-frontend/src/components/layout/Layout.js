import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Background from './Background';

const Layout = ({ children }) => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isPlayPage = location.pathname === '/play' || location.pathname.startsWith('/play/');
  const headerRef = useRef(null);

  useEffect(() => {
    // Only apply header hiding logic on play pages in landscape mode on mobile
    if (!isPlayPage || isLandingPage) return;

    const header = headerRef.current;

    const checkLandscapeAndHide = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 812; // iPhone X width in landscape

      if (isLandscape && isMobile && headerRef.current) {
        // Immediately hide header in mobile landscape mode
        headerRef.current.style.display = 'none';
        headerRef.current.style.visibility = 'hidden';
        headerRef.current.style.height = '0';
        headerRef.current.style.overflow = 'hidden';
      } else {
        // Not in landscape mobile mode, ensure header is visible
        if (headerRef.current) {
          headerRef.current.style.display = '';
          headerRef.current.style.visibility = '';
          headerRef.current.style.height = '';
          headerRef.current.style.overflow = '';
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
      // Restore header visibility on cleanup
      if (header) {
        header.style.display = '';
        header.style.visibility = '';
        header.style.height = '';
        header.style.overflow = '';
      }
    };
  }, [isPlayPage, isLandingPage, location.pathname]);

  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div>
      <Background />
      <div ref={headerRef}>
        <Header />
      </div>
      <div className="relative z-0">{children}</div>
    </div>
  );
};

export default Layout;