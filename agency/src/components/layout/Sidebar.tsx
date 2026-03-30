import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiToggleLeft, FiLogOut, FiZap
} from 'react-icons/fi';
import { useAgency } from '../../context/AgencyContext.tsx';

const NAV_ITEMS = [
  { to: '/',                label: 'Dashboard',      icon: <FiGrid /> },
  { to: '/subaccount-sims', label: 'Subaccount SIMs', icon: <FiToggleLeft /> },
];

export const Sidebar = () => {
  const { agencyId } = useAgency();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('nola_agency_id');
    navigate('/');
    window.location.reload();
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-inner">
          <div className="sidebar-brand-icon">
            <FiZap />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">NOLA SMS Pro</span>
            <span className="sidebar-brand-sub">Agency</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Menu</span>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {agencyId && (
          <div style={{ padding: '0 4px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
            Agency ID: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{agencyId.slice(0, 12)}…</span>
          </div>
        )}
        <button className="sidebar-footer-btn" onClick={handleLogout}>
          <FiLogOut />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
