import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

/**
 * ProtectedRoute
 * Guards routes with auth verification. If inside a GHL iframe (indicated by 
 * location_id or sessionkey), we bypass the login requirement.
 */
export const ProtectedRoute: React.FC = () => {
  const isAuth = isAuthenticated();

  // Check for GHL iframe parameters to bypass login
  const searchParams = new URLSearchParams(window.location.search);
  const hashString = window.location.hash;
  let urlHasParams = false;
  try {
    urlHasParams = searchParams.has('location_id') || searchParams.has('locationId') || searchParams.has('location') || searchParams.has('id') ||
                  hashString.includes('location_id=') || hashString.includes('locationId=') || hashString.includes('location=') || hashString.includes('id=') ||
                  searchParams.has('sessionkey') || hashString.includes('sessionkey=');
  } catch (e) {
    // Ignore URL parsing errors
  }

  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch (e) {
    // If accessing top throws a DOMException, it absolutely means we're in a cross-origin iframe
    isIframe = true;
  }

  let savedGhlState = false;
  try {
    if (urlHasParams || isIframe) {
      sessionStorage.setItem('nola_is_ghl_frame', 'true');
      localStorage.setItem('nola_is_ghl_frame', 'true');
    }
    savedGhlState = sessionStorage.getItem('nola_is_ghl_frame') === 'true' || 
                    localStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch (e) {
    // Ignore storage errors in incognito/strict-privacy mode
  }

  const isGHL = urlHasParams || isIframe || savedGhlState;

  if (!isAuth && !isGHL) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
