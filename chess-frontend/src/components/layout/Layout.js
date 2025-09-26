import React from 'react';
import { useLocation } from 'react-router-dom';
import Background from './Background';

const Layout = ({ children }) => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div>
      <Background />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default Layout;