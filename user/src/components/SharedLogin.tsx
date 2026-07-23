import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const SharedLogin: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  let isGhlFrame = false;
  try {
    isGhlFrame = window.self !== window.top || sessionStorage.getItem('nola_is_ghl_frame') === 'true';
  } catch {
    isGhlFrame = true;
  }
  useEffect(() => {
    // 1. If already logged in, go to main dashboard
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    // 2. If inside GHL iframe, let autologin/bootstrap handle session on /
    if (isGhlFrame) {
      navigate('/', { replace: true });
      return;
    }
    // 3. Standalone browser tab -> Redirect to backend PHP login page
    const baseUrl = import.meta.env.VITE_API_BASE || 'https://smspro-api.nolacrm.io';
    const targetUrl = new URL(`${baseUrl}/login`);
    const params = new URLSearchParams(window.location.search);
    params.forEach((value, key) => targetUrl.searchParams.set(key, value));
    window.location.replace(targetUrl.toString());
  }, [isAuthenticated, isGhlFrame, navigate]);
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#f7f8fc] dark:bg-[#0a0a0b]">
      <div className="w-10 h-10 rounded-full border-4 border-[#2b83fa]/20 border-t-[#2b83fa] animate-spin" />
    </div>
  );
};
export default SharedLogin;
