import React, { useState } from 'react';
import { FiUsers, FiSend, FiSettings, FiLogOut, FiLock, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import logoUrl from '../../assets/NOLA SMS PRO Logo.png';

interface AdminLayoutProps {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple hardcoded credentials for now. Can be replaced with backend auth.
        if (username === 'admin' && password === 'admin123') {
            onLogin();
            setError(false);
        } else {
            setError(true);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center p-4 bg-[#f7f7f7] dark:bg-[#111111]">
            <div className="w-full max-w-md bg-white dark:bg-[#1a1b1e] rounded-2xl shadow-xl border border-[#e5e5e5] dark:border-white/5 p-8 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center mb-8">
                    <img src={logoUrl} alt="NOLA SMS Pro Logo" className="w-32 h-32 mb-2 object-contain" />
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] text-center">
                        Enter your credentials to access NOLA SMS Pro admin dashboard.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                            <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-[12px] font-medium text-red-600 dark:text-red-400">Incorrect username or password.</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Username</label>
                        <input
                            type="text"
                            autoFocus
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (error) setError(false);
                            }}
                            placeholder="e.g. admin"
                            className="w-full px-4 py-3 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Password</label>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError(false);
                                }}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6e6e73] dark:text-[#9aa0a6] hover:text-[#111111] dark:hover:text-[#ececf1] transition-colors"
                            >
                                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={() => alert("Password reset functionality is not currently implemented in this demo.")}
                                className="text-[11px] font-semibold text-[#2b83fa] hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!username.trim() || !password.trim()}
                        className="w-full flex items-center justify-center gap-2 mt-4 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none pointer-events-auto"
                    >
                        Log In
                    </button>
                </form>
            </div>
        </div>
    );
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({ darkMode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState<'accounts' | 'requests' | 'settings'>('requests');

    if (!isAuthenticated) {
        return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className={`h-screen flex overflow-hidden bg-[#f7f7f7] dark:bg-[#111111] ${darkMode ? 'dark' : ''}`}>
            {/* Admin Sidebar */}
            <div className="w-64 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-r border-[#0000000a] dark:border-[#ffffff0a] shadow-[1px_0_0_rgba(0,0,0,0.05)] flex flex-col z-20">
                <div className="p-6">
                    <h1 className="text-xl font-black text-[#111111] dark:text-white tracking-tight flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] shadow-sm flex items-center justify-center">
                            <FiLock className="w-3.5 h-3.5 text-white" />
                        </div>
                        NOLA Admin
                    </h1>
                </div>

                <nav className="flex-1 px-4 py-2 space-y-1.5">
                    {[
                        { id: 'requests', label: 'Sender Requests', icon: <FiSend /> },
                        { id: 'accounts', label: 'All Accounts', icon: <FiUsers /> },
                        { id: 'settings', label: 'System Settings', icon: <FiSettings /> },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all group ${
                                    isActive
                                        ? 'bg-[#2b83fa]/10 dark:bg-[#2b83fa]/15 text-[#2b83fa]'
                                        : 'text-[#6e6e73] dark:text-[#94959b] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#111111] dark:hover:text-[#ececf1]'
                                }`}
                            >
                                <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-[#2b83fa]'}`}>{tab.icon}</span>
                                <span className={isActive ? 'font-bold' : ''}>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#00000005] dark:border-[#ffffff05]">
                    <button 
                        onClick={() => setIsAuthenticated(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-[#6e6e73] dark:text-[#94959b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                        <FiLogOut /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="px-8 py-5 bg-white/70 dark:bg-[#121415]/80 backdrop-blur-2xl border-b border-[#0000000a] dark:border-[#ffffff0a] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[#111111] dark:text-white capitalize tracking-tight">
                            {activeTab.replace('-', ' ')}
                        </h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                            Management overview and administrative actions.
                        </p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'requests' && <AdminSenderRequests />}
                        {activeTab === 'accounts' && <AdminAccounts />}
                        {activeTab === 'settings' && <AdminSettings />}
                    </div>
                </main>
            </div>
        </div>
    );
};

// ─── Placeholder Components for Admin Views ─────────────────────────────────

const AdminSenderRequests: React.FC = () => (
    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-[#111111] dark:text-white mb-2">Pending Sender ID Requests</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-6">
            Review and approve requests submitted by users. Once approved, you will generate and input their NOLA SMS Pro API Key here.
        </p>
        
        <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
            <FiSend className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-semibold">Table of pending requests will be populated by the backend API.</p>
            <p className="text-[12px] font-mono mt-2 opacity-70">GET /admin/all-sender-requests</p>
        </div>
    </div>
);

const AdminAccounts: React.FC = () => (
    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-[#111111] dark:text-white mb-2">All User Accounts</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-6">
            Overview of all mapped GHL subaccounts, credit balances, and their currently active Sender IDs.
        </p>
        
        <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
            <FiUsers className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-semibold">Table of all user accounts will be populated by the backend API.</p>
            <p className="text-[12px] font-mono mt-2 opacity-70">GET /admin/accounts</p>
        </div>
    </div>
);

const AdminSettings: React.FC = () => (
    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-[#111111] dark:text-white mb-2">System Configurations</h3>
        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-6">
            Global settings like the master fallback Sender ID and free tier limits.
        </p>
        
        <div className="space-y-5 max-w-md">
            <div>
                <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">System Default Sender ID</label>
                <input className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" defaultValue="NOLASMSPro" />
            </div>
            <div>
                <label className="block text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Free Usage Limit</label>
                <input type="number" className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" defaultValue="10" />
            </div>
            <div className="pt-2">
                <button className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 active:scale-95">
                    Save System Settings
                </button>
            </div>
        </div>
    </div>
);
