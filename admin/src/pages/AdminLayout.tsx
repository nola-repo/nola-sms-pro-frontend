// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FiUsers, FiSend, FiLogOut, FiHome, FiActivity, FiShield, FiSun, FiMoon, FiMenu, FiX, FiBriefcase } from 'react-icons/fi';
import { NotificationBell } from '../components/ui/NotificationBell';
import faviconLogo from '../assets/FAV ICON - NOLA SMS PRO.png';

import { AdminLogin } from './components/AdminLogin';
import { AdminForgotPassword } from './components/AdminForgotPassword';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSenderRequests } from './components/SenderRequests';
import { AdminAccounts } from './components/AdminAccounts';
import { AdminTeamManagement } from './components/AdminUsersManagement';
import { AdminLogs } from './components/SystemSettings';
import { AdminAgencies } from './components/AdminAgencies';
import { ADMIN_AUTH_REQUIRED_EVENT } from '../utils/adminApi';

const NAV_ITEMS = [
    { path: '/dashboard',  label: 'Dashboard',        icon: <FiHome /> },
    { path: '/requests',   label: 'Sender Requests',  icon: <FiSend /> },
    { path: '/activity',   label: 'Platform Activity', icon: <FiActivity /> },
    { path: '/accounts',   label: 'All Subaccounts',  icon: <FiUsers /> },
    { path: '/agencies',   label: 'All Agencies',     icon: <FiBriefcase /> },
    { path: '/admins',     label: 'Admin Users',      icon: <FiShield /> },
    // { path: '/settings',   label: 'System Settings',  icon: <FiSettings /> },
] as const;

const PAGE_HEADERS = {
    requests: {
        title: 'Sender Requests',
        subtitle: 'Review sender names, approval status, and account requests.',
    },
    activity: {
        title: 'Platform Activity',
        subtitle: 'Track SMS, credit, and billing events across all accounts.',
    },
    accounts: {
        title: 'All Subaccounts',
        subtitle: 'Manage connected subaccounts, credit balances, and sender access.',
    },
    agencies: {
        title: 'All Agencies',
        subtitle: 'Monitor agency accounts and platform ownership at a glance.',
    },
    admins: {
        title: 'Admin Users',
        subtitle: 'Manage admin access, permissions, and team membership.',
    },
    // settings: {
    //     title: 'System Settings',
    //     subtitle: 'Configure platform defaults, free tier limits, and admin controls.',
    // },
} as const;

const NavItems = ({ onNav }: { onNav?: () => void }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <>
            {NAV_ITEMS.map(item => {
                const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');
                return (
                    <button
                        key={item.path}
                        onClick={() => { navigate(item.path); onNav?.(); }}
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
                            {item.icon}
                        </div>
                        <span className={`text-[13.5px] transition-all duration-200 ${isActive ? 'font-bold tracking-tight' : 'font-medium'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </>
    );
};

const SidebarContent = ({ onNav, onLogout }: { onNav?: () => void; onLogout: () => void }) => (
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
                        <span className="text-[10px] font-bold text-[#6e6e73] dark:text-[#94959b] uppercase tracking-widest opacity-80">Admin</span>
                    </div>
                </div>
            </div>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-0 overflow-y-auto sidebar-scroll">
            <div className="px-2 pt-1 pb-1.5">
              <span className="text-[10.5px] font-bold text-[#9aa0a6] dark:text-[#5f6368] uppercase tracking-widest">Main Menu</span>
            </div>
            <NavItems onNav={onNav} />
        </nav>

        <div className="p-4 border-t border-[#00000005] dark:border-[#ffffff05]">
            <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#94959b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
                <FiLogOut /> Logout
            </button>
        </div>
    </>
);

export const AdminLayout: React.FC<{ darkMode: boolean; toggleDarkMode: () => void }> = ({ darkMode, toggleDarkMode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() =>
        sessionStorage.getItem('nola_admin_auth') === 'true' &&
        Boolean(sessionStorage.getItem('nola_admin_token'))
    );
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

    const navigate = useNavigate();

    const clearAdminSession = useCallback(() => {
        sessionStorage.removeItem('nola_admin_auth');
        sessionStorage.removeItem('nola_admin_user');
        sessionStorage.removeItem('nola_admin_token');
        setShowLogoutConfirm(false);
        setIsAuthenticated(false);
        navigate('/dashboard');
    }, [navigate]);

    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(clearAdminSession, IDLE_TIMEOUT_MS);
    }, [clearAdminSession, IDLE_TIMEOUT_MS]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
        resetIdleTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, resetIdleTimer));
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [isAuthenticated, resetIdleTimer]);

    useEffect(() => {
        window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, clearAdminSession);
        return () => window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, clearAdminSession);
    }, [clearAdminSession]);

    const handleLogin = (username: string, token: string) => {
        sessionStorage.setItem('nola_admin_auth', 'true');
        sessionStorage.setItem('nola_admin_user', username);
        sessionStorage.setItem('nola_admin_token', token);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        clearAdminSession();
    };

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/forgot-password" element={<AdminForgotPassword darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
                <Route path="*" element={<AdminLogin onLogin={handleLogin} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
            </Routes>
        );
    }

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

    const dashboardTopControls = (
        <div className="flex items-center gap-2">
            <NotificationBell variant="light" />
            <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all shadow-sm"
                aria-label="Toggle theme"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            </button>
        </div>
    );

    const renderPage = (page: React.ReactNode, pageKey: keyof typeof PAGE_HEADERS) => {
        const header = PAGE_HEADERS[pageKey];

        return (
        <div className="relative min-h-full bg-[#f3f4f6] dark:bg-[#09090b]">
            <div className="absolute left-0 top-0 h-[144px] w-full rounded-b-[28px] bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] pointer-events-none" />
            <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 text-white">
                        {renderMobileMenuButton(true)}
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                                {header.title}
                            </h1>
                            <p className="mt-1 max-w-2xl text-[14px] sm:text-[15px] font-semibold text-white/80">
                                {header.subtitle}
                            </p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {dashboardTopControls}
                    </div>
                </div>
                <div className="pt-2 pb-8">
                    {page}
                </div>
            </div>
        </div>
        );
    };

    return (
        <div className={`h-screen flex overflow-hidden bg-[#f3f4f6] dark:bg-[#09090b] ${darkMode ? 'dark' : ''}`}>
            <div className="hidden md:flex w-64 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] flex-col z-20 flex-shrink-0">
                <SidebarContent onLogout={() => setShowLogoutConfirm(true)} />
            </div>

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
                <SidebarContent
                    onNav={() => setIsMobileOpen(false)}
                    onLogout={() => {
                        setIsMobileOpen(false);
                        setShowLogoutConfirm(true);
                    }}
                />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f3f4f6] dark:bg-[#09090b]">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route
                            path="/dashboard"
                            element={(
                                <AdminDashboard
                                    onNavigate={(tab) => navigate(`/${tab}`)}
                                    mobileMenuButton={renderMobileMenuButton(true)}
                                    topControls={dashboardTopControls}
                                />
                            )}
                        />
                        <Route path="/requests" element={renderPage(<AdminSenderRequests />, 'requests')} />
                        <Route path="/activity" element={renderPage(<AdminLogs />, 'activity')} />
                        <Route path="/accounts" element={renderPage(<AdminAccounts />, 'accounts')} />
                        <Route path="/agencies" element={renderPage(<AdminAgencies />, 'agencies')} />
                        <Route path="/admins" element={renderPage(<AdminTeamManagement />, 'admins')} />
                        <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </main>
            </div>

            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#e5e5e5] dark:border-white/10 bg-white dark:bg-[#1a1b1e] shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                                <FiLogOut className="w-5 h-5" />
                            </div>
                            <h3 className="text-[18px] font-bold text-[#111111] dark:text-white mb-2">Log out of Admin Panel?</h3>
                            <p className="text-[13px] leading-relaxed text-[#6e6e73] dark:text-[#9aa0a6]">
                                This will clear the current admin session and return you to the login screen.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-[#e5e5e5] dark:border-white/5 bg-[#f7f7f7] dark:bg-black/30 p-4">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="px-4 py-2 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-white dark:hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-5 py-2 rounded-xl text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
