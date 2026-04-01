import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Wrap any routes that require a valid session with this component.
 */
export const ProtectedRoute: React.FC = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};
