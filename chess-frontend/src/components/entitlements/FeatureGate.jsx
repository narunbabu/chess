import React from 'react';
import { useEntitlements } from '../../contexts/EntitlementContext';

const FeatureGate = ({ capability, fallback = null, children }) => {
  const { can, loading } = useEntitlements();

  if (loading) {
    return fallback;
  }

  return can(capability) ? children : fallback;
};

export default FeatureGate;

