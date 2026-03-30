import React, { useState, useEffect } from "react";
import { Dashboard } from "./pages/Dashboard";
import { useGhlLocation } from "./hooks/useGhlLocation";
import { GhlCallback } from "./pages/GhlCallback";
import { FiSettings } from "react-icons/fi";

const App: React.FC = () => {
  // Initialize GHL Location detection at root level so it captures the URL immediately
  const locationId = useGhlLocation();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default to light mode (false) if no preference saved
    return false;
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // When the GHL subaccount / location changes, notify the app so it can reset
  // state (e.g., return to Home, clear selections, and refetch data).
  useEffect(() => {
    if (!locationId) return;
    window.dispatchEvent(
      new CustomEvent("ghl-location-changed", { detail: { locationId } })
    );
  }, [locationId]);


  return (
    <div className="h-screen">
      {/* Theme & Settings - Fixed top right (Desktop only) */}
      {
        <div className="hidden md:flex fixed top-3 right-3 gap-2 z-50">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'account' } }))}
            className="p-2 rounded-lg bg-[#f7f7f7] dark:bg-[#2a2b32] hover:bg-[#e8e8e8] dark:hover:bg-[#3a3b3f] text-[#37352f] dark:text-[#ececf1] shadow-sm transition-all duration-200 settings-icon-rotate"
            aria-label="Open Settings"
          >
            <FiSettings className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-[#f7f7f7] dark:bg-[#2a2b32] hover:bg-[#e8e8e8] dark:hover:bg-[#3a3b3f] text-[#37352f] dark:text-[#ececf1] shadow-sm transition-all duration-200"
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      }

      {/* Basic Routing */}
      {window.location.search.includes('code=') ? (
        <GhlCallback />
      ) : (
        <Dashboard
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
    </div>
  );
};

export default App;
