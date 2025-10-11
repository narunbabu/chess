import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
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
      <Header />
      <div className="relative z-0">{children}</div>
    </div>
  );
};

export default Layout;