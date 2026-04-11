import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiGrid, FiToggleLeft, FiLogOut, FiZap, FiSun, FiMoon, FiUser, FiSettings, FiMenu, FiX } from 'react-icons/fi';
import { useAgency } from '../../context/AgencyContext.tsx';

export const AgencyLayout = ({ children, title, subtitle }) => {
  const { agencyId, agencySession, logout, darkMode, toggleDarkMode, isGhlFrame } = useAgency();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userName = agencySession?.user
    ? `${agencySession.user.firstName} ${agencySession.user.lastName}`.trim()
    : null;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <FiGrid /> },
    { to: '/subaccounts', label: 'Subaccounts', icon: <FiToggleLeft /> },
    { to: '/settings', label: 'Settings', icon: <FiSettings /> },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3.5 group cursor-pointer transition-all">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-md flex items-center justify-center shrink-0 transition-all duration-500 relative overflow-hidden group-hover:rotate-6 group-hover:scale-105 active:scale-95">
            <div className="transition-all duration-500 group-hover:rotate-[-6deg]">
               <FiZap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-[14.5px] font-extrabold text-[#111111] dark:text-white tracking-tight leading-none">
              NOLA SMS PRO
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-[#2b83fa] uppercase tracking-widest opacity-80">Agency</span>
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
                  ? 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa]'
                  : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'}
              `}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#2b83fa] rounded-r-full shadow-sm" />
              )}
              <div className={`text-[19px] transition-all duration-500 ${isActive ? 'scale-110 text-[#2b83fa]' : 'group-hover:scale-105 group-hover:text-[#2b83fa]'} active:scale-90`}>
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
        {/* Logged-in user info */}
        {userName && !isGhlFrame && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-[#2b83fa]/10 flex items-center justify-center flex-shrink-0">
              <FiUser className="w-3.5 h-3.5 text-[#2b83fa]" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#111111] dark:text-white truncate">{userName}</div>
              <div className="text-[10px] text-[#9aa0a6] truncate">{agencySession?.user?.email}</div>
            </div>
          </div>
        )}
        {agencyId && !userName && (
          <div className="px-2 text-[11px] text-[#6e6e73] dark:text-[#94959b]">
            Agency ID: <span className="font-mono text-[#111111] dark:text-[#ececf1] font-semibold">{agencyId.slice(0, 12)}…</span>
          </div>
        )}
        {isGhlFrame ? (
          <div className="px-2 py-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              GoHighLevel Connected
            </span>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#94959b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <FiLogOut className="w-4 h-4" /> Sign Out
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className={`h-screen flex overflow-hidden bg-[#f7f7f7] dark:bg-[#111111] ${darkMode ? 'dark' : ''}`}>
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
        <header className="px-6 py-4 bg-white/80 dark:bg-[#121415]/80 backdrop-blur-2xl border-b border-[#0000000a] dark:border-[#ffffff0a] flex-shrink-0 flex items-center justify-between z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-xl text-[#6e6e73] hover:text-[#111111] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
              aria-label="Open menu"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-[17px] font-bold text-[#111111] dark:text-white capitalize tracking-tight leading-tight">
                {title || 'Agency Panel'}
              </h2>
              {subtitle && (
                <p className="text-[11.5px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-[#f7f7f7] dark:bg-[#1e2023] border border-[#e5e5e5] dark:border-white/5 text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white hover:bg-[#efefef] dark:hover:bg-white/5 transition-all shadow-sm"
            aria-label="Toggle theme"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#f7f7f7] dark:bg-[#111111] custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
