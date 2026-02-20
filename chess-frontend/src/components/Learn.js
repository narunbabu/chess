import React from 'react';
import { Navigate } from 'react-router-dom';

// /learn redirects to the Tutorial page which is the canonical learn section.
const Learn = () => <Navigate to="/tutorial" replace />;

export default Learn;
