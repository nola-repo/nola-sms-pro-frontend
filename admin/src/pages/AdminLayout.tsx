// @ts-nocheck
import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FiUsers, FiSend, FiSettings, FiLogOut, FiLock, FiHome, FiActivity, FiShield, FiSun, FiMoon } from 'react-icons/fi';

import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSenderRequests } from './components/SenderRequests';
import { AdminAccounts } from './components/AdminAccounts';
import { AdminTeamManagement } from './components/AdminUsersManagement';
import { AdminLogs, AdminSettings } from './components/SystemSettings';

const NAV_ITEMS = [
    { path: '/dashboard',  label: 'Dashboard',        icon: <FiHome /> },
    { path: '/requests',   label: 'Sender Requests',   icon: <FiSend /> },
    { path: '/activity',   label: 'Platform Activity', icon: <FiActivity /> },
    { path: '/accounts',   label: 'All Accounts',      icon: <FiUsers /> },
    { path: '/admins',     label: 'Admin Users',       icon: <FiShield /> },
    { path: '/settings',   label: 'System Settings',   icon: <FiSettings /> },
] as const;

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
    '/dashboard': { title: 'Dashboard',         subtitle: 'Platform-wide overview of all accounts and activity.' },
    '/requests':  { title: 'Sender Requests',   subtitle: 'Management overview and administrative actions.' },
    '/activity':  { title: 'Platform Activity', subtitle: 'All SMS, credit, and billing events across accounts.' },
    '/accounts':  { title: 'All Accounts',      subtitle: 'Overview of all mapped GHL subaccounts and credits.' },
    '/admins':    { title: 'Admin Users',        subtitle: 'Manage admin access and team permissions.' },
    '/settings':  { title: 'System Settings',   subtitle: 'Global configuration and platform settings.' },
};

export const AdminLayout: React.FC<{ darkMode: boolean; toggleDarkMode: () => void }> = ({ darkMode, toggleDarkMode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() =>
        localStorage.getItem('nola_admin_auth') === 'true'
    );

    const navigate   = useNavigate();
    const { pathname } = useLocation();

    const handleLogin = (username: string) => {
        localStorage.setItem('nola_admin_auth', 'true');
        localStorage.setItem('nola_admin_user', username);
        setIsAuthenticated(true);
        fetch('/api/admin_users.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'record_login', username }),
        }).catch(() => {});
    };

    const handleLogout = () => {
        localStorage.removeItem('nola_admin_auth');
        setIsAuthenticated(false);
        navigate('/dashboard');
    };

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
    }

    const page = PAGE_TITLES[pathname] ?? PAGE_TITLES['/dashboard'];

    return (
        <div className={`h-screen flex overflow-hidden bg-[#f7f7f7] dark:bg-[#111111] ${darkMode ? 'dark' : ''}`}>
            {/* Sidebar */}
            <div className="w-64 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] flex flex-col z-20">
                <div className="px-5 pt-5 pb-4">
                    <div className="flex items-center gap-3.5 group cursor-pointer transition-all">
                        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-md flex items-center justify-center shrink-0 transition-all duration-500 relative overflow-hidden group-hover:rotate-6 group-hover:scale-105 active:scale-95">
                            <div className="transition-all duration-500 group-hover:rotate-[-6deg]">
                               <FiLock className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[14.5px] font-extrabold text-[#111111] dark:text-white tracking-tight leading-none">
                                NOLA SMS PRO
                            </h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold text-[#2b83fa] uppercase tracking-widest opacity-80">Admin</span>
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-1 overflow-y-auto sidebar-scroll">
                    <div className="px-2 pt-2 pb-1.5">
                      <span className="text-[10.5px] font-bold text-[#9aa0a6] dark:text-[#5f6368] uppercase tracking-widest">Main Menu</span>
                    </div>
                    {NAV_ITEMS.map(item => {
                        const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`
                                  w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 relative group
                                  ${isActive
                                      ? 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa]'
                                      : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'}
                                `}
                            >
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-[#2b83fa] rounded-r-full shadow-sm" />
                                )}
                                <div className={`text-[17px] transition-all duration-500 ${isActive ? 'scale-110 text-[#2b83fa]' : 'group-hover:scale-105 group-hover:text-[#2b83fa]'} active:scale-90`}>
                                    {item.icon}
                                </div>
                                <span className={`text-[12.5px] transition-all duration-200 ${isActive ? 'font-bold tracking-tight' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#00000005] dark:border-[#ffffff05]">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#94959b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                        <FiLogOut /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="px-8 py-5 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-b border-[#0000000a] dark:border-[#ffffff0a] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[#111111] dark:text-white capitalize tracking-tight">{page.title}</h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">{page.subtitle}</p>
                    </div>
                    <button
                        onClick={toggleDarkMode}
                        className="p-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#1e2023] border border-[#e5e5e5] dark:border-white/5 text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white hover:bg-[#efefef] dark:hover:bg-white/5 transition-all shadow-sm"
                        aria-label="Toggle theme"
                        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto">
                        <Routes>
                            <Route path="/"           element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard"  element={<AdminDashboard onNavigate={(tab) => navigate(`/${tab}`)} />} />
                            <Route path="/requests"   element={<AdminSenderRequests />} />
                            <Route path="/activity"   element={<AdminLogs />} />
                            <Route path="/accounts"   element={<AdminAccounts />} />
                            <Route path="/admins"     element={<AdminTeamManagement />} />
                            <Route path="/settings"   element={<AdminSettings />} />
                            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    );
};
