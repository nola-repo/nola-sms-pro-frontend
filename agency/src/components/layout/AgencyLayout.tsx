import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FiGrid, FiToggleLeft, FiLogOut, FiSun, FiMoon, FiUser, FiMenu, FiX, FiCreditCard, FiAward, FiBell } from 'react-icons/fi';
import { useAgency } from '../../context/AgencyContext.tsx';
import faviconLogo from '../../assets/FAV ICON - NOLA SMS PRO.png';

export const AgencyLayout = ({ children, title, subtitle, topActions = null, variant = 'default' }) => {
  const { agencyId, agencySession, logout, darkMode, toggleDarkMode, isGhlFrame } = useAgency();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isDashboard = variant === 'dashboard';

  const userName = agencySession?.user
    ? `${agencySession.user.firstName || ''} ${agencySession.user.lastName || ''}`.trim()
    : null;
  const profileName = userName || agencySession?.user?.name || agencySession?.user?.company_name || 'Agency Profile';
  const profileEmail = agencySession?.user?.email || (agencyId ? `${agencyId.slice(0, 12)}...` : 'Agency account');
  const profileInitial = (profileName || profileEmail || 'A').charAt(0).toUpperCase();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <FiGrid /> },
    { to: '/subaccounts', label: 'Subaccounts', icon: <FiToggleLeft /> },
    { to: '/billing', label: 'Credits & Billing', icon: <FiCreditCard /> },
    { to: '/subscription', label: 'Subscription', icon: <FiAward /> },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3.5 group cursor-pointer transition-all">
          <div className="w-9 h-9 rounded-[10px] bg-white dark:bg-[#1a1b1e] border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex items-center justify-center shrink-0 transition-all duration-500 relative overflow-hidden group-hover:rotate-3 group-hover:scale-105 active:scale-95">
            <div className="transition-all duration-500 group-hover:rotate-[-6deg]">
               <img src={faviconLogo} alt="NOLA SMS PRO" className="h-7 w-7 object-contain" />
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-[14.5px] font-extrabold text-[#111111] dark:text-white tracking-tight leading-none">
              NOLA SMS PRO
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-[#6e6e73] dark:text-[#94959b] uppercase tracking-widest opacity-80">Agency</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-0 overflow-y-auto sidebar-scroll">
        <div className="px-2 pt-1 pb-1.5">
          <span className="text-[10.5px] font-bold text-[#9aa0a6] dark:text-[#5f6368] uppercase tracking-widest">Main Menu</span>
        </div>
        {navItems.map(({ to, label, icon }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsMobileOpen(false)}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 relative group
                ${isActive
                  ? 'bg-[#eceff3] text-[#111111] dark:bg-[#202327] dark:text-white'
                  : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'}
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#111111] dark:bg-white/80 rounded-r-full shadow-sm" />
              )}
              <div className={`text-[19px] transition-all duration-500 ${isActive ? 'scale-110 text-[#111111] dark:text-white' : 'group-hover:scale-105 group-hover:text-[#111111] dark:group-hover:text-white'} active:scale-90`}>
                {icon}
              </div>
              <span className={`text-[13.5px] transition-all duration-200 ${isActive ? 'font-bold tracking-tight' : 'font-medium'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#00000005] dark:border-[#ffffff05] flex flex-col gap-2">
        {isGhlFrame ? (
          <div className="px-2 py-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              GoHighLevel Connected
            </span>
          </div>
        ) : (
          <div className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-colors ${
            location.pathname === '/settings'
              ? 'border-[#2b83fa]/30 bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15'
              : 'border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          }`}>
            <button
              type="button"
              onClick={() => {
                navigate('/settings');
                setIsMobileOpen(false);
              }}
              className="min-w-0 flex flex-1 items-center gap-2.5 text-left"
              aria-label="Open agency profile"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] text-[13px] font-black text-white shadow-sm">
                {profileInitial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-extrabold text-[#111111] dark:text-white">
                  {profileName}
                </span>
                <span className="block truncate text-[10.5px] font-medium text-[#6e6e73] dark:text-[#94959b]">
                  {profileEmail}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#6e6e73] transition-colors hover:bg-red-50 hover:text-red-500 dark:text-[#94959b] dark:hover:bg-red-900/10"
              aria-label="Sign out"
              title="Sign out"
            >
              <FiLogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  const renderMobileMenuButton = (light = false) => (
    <button
      onClick={() => setIsMobileOpen(true)}
      className={`md:hidden flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
        light
          ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
          : 'bg-white dark:bg-[#1c1e21] border border-[#e5e5e5] dark:border-white/10 text-[#111111] dark:text-white shadow-sm hover:bg-[#f7f7f7] dark:hover:bg-white/10'
      }`}
      aria-label="Open menu"
    >
      <FiMenu className="w-5 h-5" />
    </button>
  );

  const topControls = (
    <div className="relative flex items-center gap-2">
      {topActions}
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all"
        aria-label="Open agency profile"
        title="Agency profile"
      >
        <FiUser className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setNotificationsOpen(prev => !prev)}
        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all"
        aria-label="Open notifications"
        title="Notifications"
      >
        <FiBell className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={toggleDarkMode}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all"
        aria-label="Toggle theme"
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
      </button>
      {notificationsOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#1a1b1e]/95 p-4 text-white shadow-2xl backdrop-blur-xl z-50">
          <div className="flex items-center gap-2 mb-2">
            <FiBell className="w-4 h-4 text-[#60a5fa]" />
            <p className="text-[13px] font-bold">Notifications</p>
          </div>
          <p className="text-[12px] leading-relaxed text-white/70">
            No agency notifications yet.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`h-screen flex overflow-hidden bg-[#f3f4f6] dark:bg-[#09090b] ${darkMode ? 'dark' : ''}`}>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] flex-col z-20 flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 left-0 z-[100] md:hidden w-72 bg-white/95 dark:bg-[#121415]/95 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDashboard ? 'bg-[#050607]' : 'bg-[#f3f4f6] dark:bg-[#09090b]'}`}>
          <div className="relative min-h-full">
            <div className={`absolute left-0 top-0 w-full bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] pointer-events-none ${isDashboard ? 'h-[340px] rounded-b-[40px]' : 'h-[132px] rounded-b-[28px]'}`} />
            <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${isDashboard ? 'mb-8' : 'mb-14'}`}>
                <div className="flex items-start gap-3 text-white">
                  {renderMobileMenuButton(true)}
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                      {title || 'Agency Panel'}
                    </h1>
                    {subtitle && (
                      <p className="mt-1 max-w-2xl text-[14px] sm:text-[15px] font-semibold text-white/80">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {topControls}
                </div>
              </div>
              <div className={isDashboard ? 'pb-10' : 'pb-8'}>
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
