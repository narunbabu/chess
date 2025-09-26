
import React from 'react';
import { useLocation } from 'react-router-dom';
import Layout from './Layout';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return isLandingPage ? <>{children}</> : <Layout>{children}</Layout>;
};

export default MainLayout;
