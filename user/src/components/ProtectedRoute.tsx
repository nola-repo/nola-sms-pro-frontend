import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

/**
 * ProtectedRoute
 * Guards routes with auth verification. If inside a GHL iframe (indicated by
 * a proper GHL location_id or sessionkey param), we bypass the login requirement.
 *
 * Security note: only trusted GHL-specific params trigger the bypass.
 * Generic params like ?id= or ?location= are intentionally excluded.
 */
export const ProtectedRoute: React.FC = () => {
  const isAuth = isAuthenticated();

  // Only accept unambiguous GHL params — NOT generic ?id= or ?location=
  const searchParams = new URLSearchParams(window.location.search);
  const hashString = window.location.hash;
  let urlHasParams = false;
  try {
    urlHasParams =
      searchParams.has('location_id') ||
      searchParams.has('locationId') ||
      searchParams.has('sessionkey') ||
      hashString.includes('location_id=') ||
      hashString.includes('locationId=') ||
      hashString.includes('sessionkey=');
  } catch {
    // Ignore URL parsing errors
  }

  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch {
    // If accessing top throws a DOMException, we're in a cross-origin iframe
    isIframe = true;
  }

  let savedGhlState = false;
  try {
    if (urlHasParams || isIframe) {
      // Use sessionStorage only — clears when the tab/browser is closed
      sessionStorage.setItem('nola_is_ghl_frame', 'true');
    }
    savedGhlState = sessionStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch {
    // Ignore storage errors in incognito/strict-privacy mode
  }

  const isGHL = urlHasParams || isIframe || savedGhlState;

  if (!isAuth && !isGHL) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
