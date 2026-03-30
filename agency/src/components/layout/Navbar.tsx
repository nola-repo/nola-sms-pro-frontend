import React from 'react';
import { FiSun, FiMoon, FiBell } from 'react-icons/fi';
import { useAgency } from '../../context/AgencyContext.tsx';

export const Navbar = ({ title, subtitle }) => {
  const { darkMode, toggleDarkMode } = useAgency();

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div>
          <div className="navbar-title">{title || 'Agency Panel'}</div>
          {subtitle && <div className="navbar-subtitle">{subtitle}</div>}
        </div>
      </div>

      <div className="navbar-right">
        <button
          className="icon-btn"
          onClick={toggleDarkMode}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? <FiSun /> : <FiMoon />}
        </button>
      </div>
    </header>
  );
};
