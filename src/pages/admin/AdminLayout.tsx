import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiSend, FiSettings, FiLogOut, FiLock, FiAlertCircle, FiEye, FiEyeOff, FiCopy, FiCheck, FiX, FiRefreshCw, FiKey, FiHome, FiClock, FiActivity, FiMessageSquare, FiCreditCard, FiShield, FiPlus, FiTrash2, FiChevronLeft, FiChevronRight, FiSearch, FiSun, FiMoon, FiMoreVertical, FiToggleLeft } from 'react-icons/fi';
import logoUrl from '../../assets/NOLA SMS PRO Logo.png';
import Antigravity from '../../components/ui/Antigravity';

const ADMIN_API = '/api/admin_sender_requests.php';
const POLL_INTERVAL = 15000; // 15 seconds real-time sync

// ─── Types ───────────────────────────────────────────────────────────────────

interface SenderRequest {
    id: string;
    location_id: string;
    requested_id: string;
    purpose?: string;
    sample_message?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_note?: string;
    created_at?: string;
    location_name?: string;
}

interface Account {
    id: string;
    location_id: string;
    location_name?: string;
    approved_sender_id?: string;
    nola_pro_api_key?: string;
    api_key?: string;
    semaphore_api_key?: string;
    credits?: number;
    credit_balance?: number;
    free_usage_count?: number;
    free_credits_total?: number;
}

interface AdminLayoutProps {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

// ─── Admin Login ─────────────────────────────────────────────────────────────

const AdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Forgot Password Flow States
    const [view, setView] = useState<'login' | 'forgot'>('login');
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        try {
            const res = await fetch('/api/admin_auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            // If the endpoint isn't built yet, it might return a 404 HTML page or fail parsing
            if (!res.ok) {
                throw new Error('API not available, fallback to hardcoded');
            }

            const json = await res.json();
            if (json.status === 'success') {
                onLogin();
            } else {
                setError(true);
            }
        } catch (err) {
            // Fallback for seamless dev transition before backend is deployed
            if (username === 'admin' && password === 'admin123') {
                onLogin();
            } else {
                setError(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(false);
        try {
            await fetch('/api/admin_forgot_password.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername })
            });
            // We gently fall back on success even if it errors to allow seamless frontend dev flow
            setForgotSuccess(true);
        } catch (err) {
            // Still show success to prevent user enumeration
            setForgotSuccess(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen grid place-items-center p-4 overflow-hidden bg-[#f7f7f7] dark:bg-[#111111]">
            <div className="absolute inset-0 z-0">
                <Antigravity
                    count={300}
                    magnetRadius={6}
                    ringRadius={7}
                    waveSpeed={0.4}
                    waveAmplitude={1}
                    particleSize={1}
                    lerpSpeed={0.05}
                    color="#1e57a1"
                    autoAnimate
                    particleVariance={1}
                    rotationSpeed={0}
                    depthFactor={1}
                    pulseSpeed={3}
                    particleShape="capsule"
                    fieldStrength={10}
                />
            </div>
            <div className="relative z-10 w-full max-w-md bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/40 dark:border-white/10 p-8 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center mb-8">
                    <img src={logoUrl} alt="NOLA SMS Pro Logo" className="w-32 h-32 mb-2 object-contain" />
                    {view === 'login' ? (
                        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] text-center">
                            Enter your credentials to access NOLA SMS Pro admin dashboard.
                        </p>
                    ) : (
                        <p className="text-[16px] font-bold text-[#111111] dark:text-white text-center mt-2">
                            Reset Password
                        </p>
                    )}
                </div>

                {view === 'forgot' ? (
                    <form onSubmit={handleForgotSubmit} className="admin-login-fields space-y-6 w-full">
                        {forgotSuccess ? (
                            <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200">
                                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <FiCheck className="w-6 h-6 text-emerald-400" />
                                </div>
                                <p className="text-[14px] text-[#6e6e73] dark:text-[#9aa0a6]">
                                    If an admin with that identifier exists, a secure password reset link has been dispatched to the registered email address.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setView('login'); setForgotSuccess(false); setForgotUsername(''); }}
                                    className="mt-4 text-[14px] font-bold text-[#2b83fa] hover:text-[#1d6bd4] transition-colors"
                                >
                                    Back to Log In
                                </button>
                            </div>
                        ) : (
                            <div className="animate-in fade-in duration-200">
                                <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] text-center mb-6">
                                    Enter your admin username or email and we'll send you a link to reset your password.
                                </p>
                                <div className="space-y-2.5 w-full">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">USERNAME OR EMAIL</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={forgotUsername}
                                        onChange={(e) => { setForgotUsername(e.target.value); if (error) setError(false); }}
                                        placeholder="e.g. admin"
                                        className="w-full px-5 py-4 rounded-[18px] border border-gray-200 dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0a0b0d] text-[15px] font-sans font-medium text-[#111111] dark:text-white placeholder-gray-400 dark:placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="flex flex-col gap-3 pt-6">
                                    <button
                                        type="submit"
                                        disabled={!forgotUsername.trim() || loading}
                                        className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-[16px] font-bold text-[16px] transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none disabled:shadow-none"
                                    >
                                        {loading ? <FiRefreshCw className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setView('login'); setError(false); }}
                                        className="w-full py-3 text-[14px] font-bold text-[#6e6e73] hover:text-[#111111] dark:text-[#9aa0a6] dark:hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="admin-login-fields space-y-8 animate-in fade-in duration-200">
                        {error && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                                <FiAlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                                <p className="text-[12px] font-medium text-red-600 dark:text-red-300">Incorrect username or password.</p>
                            </div>
                        )}
                        
                        <div className="space-y-2.5">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">USERNAME</label>
                            <input
                                type="text"
                                autoFocus
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); if (error) setError(false); }}
                                placeholder="e.g. admin"
                                className="w-full px-5 py-4 rounded-[18px] border border-gray-200 dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0a0b0d] text-[15px] font-sans font-medium text-[#111111] dark:text-white placeholder-gray-400 dark:placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all shadow-inner"
                            />
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between ml-1">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest">PASSWORD</label>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); if (error) setError(false); }}
                                    placeholder="••••••••"
                                    className="w-full px-5 py-4 rounded-[18px] border border-gray-200 dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0a0b0d] text-[15px] font-sans font-medium text-[#111111] dark:text-white placeholder-gray-400 dark:placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all shadow-inner pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 dark:text-white/20 hover:text-gray-600 dark:hover:text-white transition-colors"
                                >
                                    {showPassword ? <FiEyeOff className="w-[18px] h-[18px]" /> : <FiEye className="w-[18px] h-[18px]" />}
                                </button>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={() => setView('forgot')}
                                    className="text-[13px] font-bold text-[#2b83fa] hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!username.trim() || !password.trim() || loading}
                            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-[16px] font-bold text-[16px] transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none disabled:shadow-none mt-2"
                        >
                            {loading ? <FiRefreshCw className="w-5 h-5 animate-spin" /> : 'Log In'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// ─── Admin Layout Shell ───────────────────────────────────────────────────────

export const AdminLayout: React.FC<AdminLayoutProps> = ({ darkMode, toggleDarkMode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('nola_admin_auth') === 'true';
    });
    const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'requests' | 'admins' | 'activity' | 'settings'>('dashboard');

    const handleLogin = () => {
        localStorage.setItem('nola_admin_auth', 'true');
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('nola_admin_auth');
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />;
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
                        { id: 'dashboard', label: 'Dashboard', icon: <FiHome /> },
                        { id: 'requests', label: 'Sender Requests', icon: <FiSend /> },
                        { id: 'activity', label: 'Platform Activity', icon: <FiActivity /> },
                        { id: 'accounts', label: 'All Accounts', icon: <FiUsers /> },
                        { id: 'admins', label: 'Admin Users', icon: <FiShield /> },
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
                        onClick={handleLogout}
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
                            {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'requests' ? 'Sender Requests' : activeTab === 'accounts' ? 'All Accounts' : activeTab === 'admins' ? 'Admin Users' : activeTab === 'activity' ? 'Platform Activity' : 'System Settings'}
                        </h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                            {activeTab === 'dashboard' ? 'Platform-wide overview of all accounts and activity.' : 'Management overview and administrative actions.'}
                        </p>
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
                        {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
                        {activeTab === 'requests' && <AdminSenderRequests />}
                        {activeTab === 'accounts' && <AdminAccounts />}
                        {activeTab === 'admins' && <AdminTeamManagement />}
                        {activeTab === 'activity' && <AdminLogs />}
                        {activeTab === 'settings' && <AdminSettings />}
                    </div>
                </main>
            </div>
        </div>
    );
};

// ─── Admin Dashboard View ────────────────────────────────────────────────────

const AdminDashboard: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [requests, setRequests] = useState<SenderRequest[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchData = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const [accRes, logsRes, reqRes] = await Promise.all([
                fetch(`${ADMIN_API}?action=accounts`).catch(() => null),
                fetch(`${ADMIN_API}?action=logs`).catch(() => null),
                fetch(ADMIN_API).catch(() => null)
            ]);

            if (accRes) {
                const accJson = await accRes.json();
                if (accJson.status === 'success') {
                    const mapped = (accJson.data || []).map((item: any) => item.data ? { id: item.id, ...item.data } : item)
                        .filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                    setAccounts(mapped);
                }
            }
            if (reqRes) {
                const reqJson = await reqRes.json();
                if (reqJson.status === 'success') setRequests(reqJson.data || []);
            }
            if (logsRes) {
                const logsJson = await logsRes.json();
                if (logsJson.status === 'success') setLogs(logsJson.data || []);
            }
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("Dashboard poll error:", err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const timer = setInterval(() => fetchData(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchData]);

    const totalAccounts = accounts.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const totalMessages = logs.length;
    const approvedSenders = accounts.filter(a => a.approved_sender_id).length;
    const recentRequests = [...requests].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

    const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) => (
        <div className={`relative p-6 rounded-3xl bg-gradient-to-br ${color} shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-white">
                <div className="w-20 h-20">{icon}</div>
            </div>
            <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-4 group-hover:rotate-6 transition-transform duration-300 shadow-inner">
                    {icon}
                </div>
                <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-1">{label}</p>
                <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">
                    {loading ? <span className="inline-block w-10 h-8 bg-white/20 animate-pulse rounded-lg" /> : value}
                </h2>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-end">
                {!loading && (
                    <span className="text-[11px] text-[#9aa0a6] font-medium">
                        Last checked: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard label="Registered Users" value={totalAccounts} color="from-[#2b83fa] to-[#60a5fa]" icon={<FiUsers className="w-full h-full" />} />
                <StatCard label="Pending Requests" value={pendingRequests} color={pendingRequests > 0 ? 'from-amber-500 to-orange-500' : 'from-slate-400 to-slate-500'} icon={<FiClock className="w-full h-full" />} />
                <StatCard label="Approved Senders" value={approvedSenders} color="from-emerald-500 to-teal-600" icon={<FiCheck className="w-full h-full" />} />
                <StatCard label="Total Messages" value={totalMessages} color="from-indigo-500 to-purple-600" icon={<FiMessageSquare className="w-full h-full" />} />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-5">Quick Actions</h3>
                    <div className="space-y-3">
                        {[
                            { tab: 'requests', label: 'Review Sender Requests', desc: `${pendingRequests} pending approval`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', icon: <FiSend className="w-5 h-5" />, badge: pendingRequests },
                            { tab: 'accounts', label: 'View All Accounts', desc: `${totalAccounts} total installed subaccounts`, color: 'text-[#2b83fa] bg-blue-50 dark:bg-blue-900/20', icon: <FiUsers className="w-5 h-5" />, badge: 0 },
                            { tab: 'settings', label: 'System Settings', desc: 'Global sender ID and free tier config', color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20', icon: <FiSettings className="w-5 h-5" />, badge: 0 },
                        ].map(item => (
                            <button key={item.tab} onClick={() => onNavigate(item.tab)}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left group">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ring-1 ring-inset ring-black/5 dark:ring-white/10`}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-bold text-[#111111] dark:text-white group-hover:text-[#2b83fa] transition-colors">{item.label}</p>
                                    <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">{item.desc}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.badge > 0 && (
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 text-white text-[11px] font-black flex items-center justify-center animate-pulse">{item.badge}</span>
                                    )}
                                    <FiChevronRight className="w-5 h-5 text-[#9aa0a6] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent Sender Requests */}
                <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider">Recent Requests</h3>
                        <button onClick={() => onNavigate('requests')} className="group text-[11px] font-black text-[#2b83fa] hover:underline transition-all duration-300 flex items-center gap-1 active:scale-95 uppercase tracking-wider">
                            See All <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {loading ? (
                            [1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)
                        ) : recentRequests.length === 0 ? (
                            <div className="py-10 text-center">
                                <FiSend className="w-8 h-8 mx-auto mb-2 text-[#d0d0d0] dark:text-[#3a3b3f]" />
                                <p className="text-[13px] text-[#9aa0a6]">No requests yet.</p>
                            </div>
                        ) : recentRequests.map(req => (
                            <div key={req.id} onClick={() => onNavigate('requests')}
                                className="group flex items-center gap-4 p-3.5 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-black flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 ${
                                    req.status === 'pending' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : req.status === 'approved' ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-red-400 to-rose-600'
                                }`}>
                                    {req.requested_id?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-bold text-[#111111] dark:text-white font-mono truncate tracking-tight">{req.requested_id}</p>
                                    <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] truncate mt-0.5">{req.location_name || req.location_id}</p>
                                </div>
                                <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${
                                    req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' :
                                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40' :
                                    'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40'
                                }`}>{req.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Platform Activity Logs (Full Width Bottom) */}
            <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[600px]">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[14px] font-bold text-[#111111] dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <FiActivity className="w-4 h-4 text-[#2b83fa]" /> Platform Activity
                    </h3>
                    <button onClick={() => onNavigate('activity')} className="group text-[11px] font-black text-[#2b83fa] hover:underline transition-all duration-300 flex items-center gap-1 active:scale-95 uppercase tracking-wider">
                        See All <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                    {loading ? (
                        [1,2,3,4,5,6].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)
                    ) : logs.length === 0 ? (
                        <div className="py-10 text-center">
                            <FiMessageSquare className="w-8 h-8 mx-auto mb-2 text-[#d0d0d0] dark:text-[#3a3b3f]" />
                            <p className="text-[13px] text-[#9aa0a6]">No logs recorded yet.</p>
                        </div>
                    ) : logs.map(log => {
                        // Determine type based on explicit type or fallback properties
                        const isNegative = typeof log.amount === 'number' && log.amount < 0;
                        const type = log.type || (
                            log.requested_id ? 'sender_request' :
                            log.amount ? (isNegative ? 'credit_usage' : 'credit_purchase') :
                            'message'
                        );
                        
                        // Get unified timestamp
                        const timestamp = log.timestamp || log.date_created || log.created_at;
                        const timeString = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        
                        const locId = log.location_id || log.account_id;
                        const account = accounts.find((a: any) => a.id === locId || a.location_id === locId);
                        
                        const subAccountPill = locId ? (
                            <div className="flex items-center gap-1.5 bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 pl-1 pr-2 py-0.5 rounded-full" title={account?.location_name || 'Unknown Account'}>
                                <div className="w-4 h-4 rounded-full bg-[#e5e5e5] dark:bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-500">
                                    {account?.location_name ? account.location_name.substring(0, 1).toUpperCase() : '?'}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[80px]">{account?.location_name || 'System'}</span>
                                    <span className="text-[9px] font-mono text-gray-400">({locId.substring(0, 5)})</span>
                                </div>
                            </div>
                        ) : null;
                        
                        // Message Event
                        if (type === 'message') {
                            const isSent = ['sent', 'delivered', 'pending', 'queued'].includes(log.status);
                            const isFailed = ['failed', 'rejected', 'undelivered', 'error'].includes(log.status);
                            return (
                                <div key={log.id} className="group flex items-center gap-4 p-3.5 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                    <div className={`w-10 h-10 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa] dark:text-[#569cfe]`}>
                                        <FiMessageSquare className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center justify-between mb-1 gap-2">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <p className="text-[14px] font-bold text-[#111111] dark:text-white truncate">
                                                    To <span className="font-mono text-[13px] ml-1">{log.number || log.to || 'Unknown'}</span>
                                                </p>
                                                <div className="flex-shrink-0 scale-90 origin-left">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${
                                                        isSent ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30' :
                                                        isFailed ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30' :
                                                        'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30'
                                                    }`}>{log.status || 'unknown'}</span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap flex-shrink-0">{timeString}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] truncate flex-1">{log.message || 'No content'}</p>
                                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
                                                {log.sendername && <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-1.5 py-0.5 rounded-md shadow-sm">Via: {log.sendername}</span>}
                                                {subAccountPill}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Credit Purchase/Usage Event
                        if (type === 'credit_purchase' || type === 'credit_usage') {
                            const isUsage = type === 'credit_usage' || (typeof log.amount === 'number' && log.amount < 0);
                            return (
                                <div key={log.id} className="group flex items-center gap-4 p-3.5 rounded-2xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                    <div className={`w-10 h-10 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 ${isUsage ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                                        {isUsage ? <FiActivity className="w-5 h-5" /> : <FiCreditCard className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center justify-between mb-1 gap-2">
                                            <p className="text-[14px] font-bold text-[#111111] dark:text-white truncate">
                                                {isUsage ? 'Credits Used' : 'Credits Purchased'}
                                            </p>
                                            <span className="text-[11px] uppercase font-bold text-[#9aa0a6] tracking-wider whitespace-nowrap flex-shrink-0">{timeString}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] truncate flex-1">
                                                {isUsage ? 'Deducted' : 'Added'} <span className={`font-bold ${isUsage ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{!isUsage && '+'}{log.amount?.toLocaleString()}</span> credits
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
                                                {log.status && <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shadow-sm bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800/30">{log.status === 'completed' ? 'Paid' : log.status}</span>}
                                                {subAccountPill}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── Sender Requests View ─────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800/30',
        approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800/30',
        rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
};

const AdminSenderRequests: React.FC = () => {
    const [requests, setRequests] = useState<SenderRequest[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showInputKey, setShowInputKey] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm]);

    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchRequests = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError(null);
        try {
            const [reqRes, accRes] = await Promise.all([
                fetch(ADMIN_API),
                fetch(`${ADMIN_API}?action=accounts`)
            ]);
            
            const reqJson = await reqRes.json();
            const accJson = await accRes.json();
            
            if (reqJson.status === 'success') {
                setRequests(reqJson.data || []);
            } else {
                setError(reqJson.message || 'Failed to load requests.');
            }

            if (accJson.status === 'success') {
                const mappedAccounts = (accJson.data || []).map((item: any) => {
                    if (item.data) return { id: item.id, ...item.data };
                    return item;
                }).filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                setAccounts(mappedAccounts);
            }
            setLastRefreshed(new Date());
        } catch {
            setError('Network error. Could not reach the backend.');
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests(true);
        const timer = setInterval(() => fetchRequests(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchRequests]);

    const doAction = async (action: string, requestId: string, extra: Record<string, string> = {}) => {
        setActionLoading(requestId + action);
        try {
            const res = await fetch(ADMIN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId, status: action, ...extra }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setSuccessMsg(json.message || 'Action completed.');
                setTimeout(() => setSuccessMsg(null), 3000);
                fetchRequests();
                setExpandedId(null);
                setRejectNote('');
                setApiKeyInput('');
                setShowApiKey(false);
                setShowInputKey(false);
            } else {
                setError(json.message || 'Action failed.');
            }
        } catch {
            setError('Network error.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-end mb-2">
                {!loading && (
                    <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">
                        Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Sender ID Requests</h3>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Review, approve, or reject sender name registration requests.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="Search requests..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 text-[12px] text-[#111111] dark:text-white placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all font-medium"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"
                            >
                                <FiX className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <button onClick={() => fetchRequests(true)} className="p-2 rounded-xl text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all border border-[#e5e5e5] dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0d0e10]">
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading && !requests.length ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Pills with Improved UI */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                {[
                    { id: 'all', label: 'All', icon: null, color: 'blue' },
                    { id: 'pending', label: 'Pending', icon: <FiClock size={12} />, color: 'amber' },
                    { id: 'approved', label: 'Approved', icon: <FiCheck size={12} />, color: 'emerald' },
                    { id: 'rejected', label: 'Rejected', icon: <FiX size={12} />, color: 'red' },
                ].map(pill => {
                    const isActive = filter === pill.id;
                    const count = pill.id === 'all' ? requests.length : requests.filter(r => r.status === pill.id).length;
                    
                    const colorMap: Record<string, any> = {
                        blue: { active: 'bg-blue-600 text-white shadow-blue-500/25', inactive: 'bg-blue-50/50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/10 hover:bg-blue-100/50' },
                        amber: { active: 'bg-amber-500 text-white shadow-amber-500/25', inactive: 'bg-amber-50/50 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/10 hover:bg-amber-100/50' },
                        emerald: { active: 'bg-emerald-600 text-white shadow-emerald-500/25', inactive: 'bg-emerald-50/50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/10 hover:bg-emerald-100/50' },
                        red: { active: 'bg-red-600 text-white shadow-red-500/25', inactive: 'bg-red-50/50 dark:bg-red-500/5 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/10 hover:bg-red-100/50' },
                    };

                    const theme = colorMap[pill.color];

                    return (
                        <button
                            key={pill.id}
                            onClick={() => { setFilter(pill.id as any); setCurrentPage(1); }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap border ${
                                isActive 
                                    ? `${theme.active} border-transparent scale-[1.02]` 
                                    : `${theme.inactive} opacity-80 hover:opacity-100`
                            }`}
                        >
                            {pill.icon}
                            <span>{pill.label}</span>
                            <span className={`flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[20px] ${
                                isActive 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-black/5 dark:bg-white/10 text-current opacity-70'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {successMsg && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400 text-[13px] font-medium">
                    <FiCheck className="w-4 h-4 flex-shrink-0" /> {successMsg}
                </div>
            )}

            {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                    <FiSend className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px] font-semibold">No sender requests found.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(() => {
                        const lowSearch = searchTerm.toLowerCase().trim();
                        const filteredRequests = requests.filter(req => {
                            const isStatusMatch = filter === 'all' || req.status === filter;
                            if (!isStatusMatch) return false;
                            
                            if (!lowSearch) return true;
                            const associatedAccount = accounts.find(a => a.location_id === req.location_id);
                            const locName = associatedAccount?.location_name || req.location_name || '';
                            
                            return (
                                req.requested_id.toLowerCase().includes(lowSearch) ||
                                req.location_id.toLowerCase().includes(lowSearch) ||
                                locName.toLowerCase().includes(lowSearch)
                            );
                        });
                        const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
                        const currentRequests = filteredRequests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                        return (
                            <>
                                {currentRequests.map(req => {
                                    const associatedAccount = accounts.find(a => a.location_id === req.location_id);
                                    const locName = associatedAccount?.location_name || req.location_name || 'Unknown Account';
                                    
                                    return (
                                        <div key={req.id} className="border border-[#e5e5e5] dark:border-white/5 rounded-xl overflow-hidden transition-all">
                                            {/* Row Header */}
                                            <div
                                                className="flex items-center gap-4 px-4 py-3 bg-[#fafafa] dark:bg-[#111214] cursor-pointer hover:bg-[#f0f0f0] dark:hover:bg-[#161718] transition-colors"
                                                onClick={() => setExpandedId(req.id)}
                                            >
                                                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] shadow-sm flex items-center justify-center text-[12px] font-black text-white flex-shrink-0 font-mono tracking-tighter">
                                                        {req.requested_id.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="font-black text-[15px] text-[#2b83fa] dark:text-[#4da3ff] font-mono leading-none">{req.requested_id}</span>
                                                            <StatusBadge status={req.status} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[11px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] truncate uppercase tracking-tight max-w-[150px]">{locName}</p>
                                                            <span className="w-1 h-1 rounded-full bg-[#d1d5db]/50 dark:bg-gray-700/50"></span>
                                                            <p className="text-[10px] text-[#9aa0a6] font-mono truncate opacity-70">{req.location_id}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {/* Approved: show masked key inline */}
                                                    {req.status === 'approved' && (
                                                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                                                            <FiKey className="w-3 h-3 inline mr-1" />Active
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setExpandedId(req.id); }}
                                                        className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                                        title="View Details"
                                                    >
                                                        <FiEye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (confirm('Are you sure you want to delete this sender request?')) doAction('deleted', req.id); }}
                                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                        title="Delete Request"
                                                    >
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-2 py-2 mt-4 bg-transparent">
                                        <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] font-medium">
                                            Showing <span className="font-bold text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)}</span> of <span className="font-bold text-[#111111] dark:text-white">{filteredRequests.length}</span> entries
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                className="p-1.5 rounded-lg text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <FiChevronLeft className="w-4 h-4" />
                                            </button>
                                            
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center transition-all ${
                                                            currentPage === page
                                                                ? 'bg-[#2b83fa] text-white shadow-sm'
                                                                : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                className="p-1.5 rounded-lg text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <FiChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Sender Request Modal */}
            {expandedId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        {(() => {
                            const req = requests.find(r => r.id === expandedId);
                            if (!req) return null;
                            const isActing = actionLoading?.startsWith(req.id);
                            const associatedAccount = accounts.find(a => a.location_id === req.location_id);
                            
                            return (
                                <>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center">
                                                <FiSend className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white font-mono leading-none">{req.requested_id}</h3>
                                                <p className="text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] mt-1 uppercase tracking-wide">
                                                    {associatedAccount?.location_name || req.location_name || 'Unknown Account'}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setExpandedId(null); setShowApiKey(false); setShowInputKey(false); }} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors self-start">
                                            <FiX className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                                        {/* Status & Highlights Banner */}
                                        <div className="grid grid-cols-2 gap-px bg-[#e5e5e5] dark:bg-white/10 rounded-xl overflow-hidden border border-[#e5e5e5] dark:border-white/5">
                                            <div className="bg-[#f7f7f7] dark:bg-[#111214] p-4 flex flex-col">
                                                <span className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1.5 opacity-70">Sender ID</span>
                                                <span className="font-black text-[16px] text-[#2b83fa] dark:text-[#4da3ff] font-mono leading-none truncate">{req.requested_id}</span>
                                            </div>
                                            <div className="bg-[#f7f7f7] dark:bg-[#111214] p-4 flex flex-col">
                                                <span className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1.5 opacity-70">Status</span>
                                                <div className="flex items-center">
                                                    <StatusBadge status={req.status} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Request Details Grid */}
                                        <div className="bg-[#f7f7f7] dark:bg-[#111214] rounded-xl p-4 gap-y-4 border border-[#e5e5e5] dark:border-white/5 flex flex-col">
                                            <div>
                                                <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Subaccount</p>
                                                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1b1e] p-2.5 rounded-lg border border-[#e5e5e5] dark:border-white/5">
                                                    <div className="w-6 h-6 rounded-full bg-[#f0f0f0] dark:bg-white/5 flex items-center justify-center text-[10px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] flex-shrink-0">
                                                        {(associatedAccount?.location_name || req.location_name || 'U').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-[13px] font-bold text-[#111111] dark:text-white leading-none">{associatedAccount?.location_name || req.location_name || 'Unknown Account'}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                                <div>
                                                    <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Location ID</p>
                                                    <p className="text-[12px] font-mono font-medium text-[#111111] dark:text-white truncate bg-white dark:bg-[#1a1b1e] p-2.5 rounded-lg border border-[#e5e5e5] dark:border-white/5" title={req.location_id}>
                                                        {req.location_id}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Submitted On</p>
                                                    <p className="text-[12px] font-medium text-[#111111] dark:text-white bg-white dark:bg-[#1a1b1e] p-2.5 rounded-lg border border-[#e5e5e5] dark:border-white/5 h-[38px] flex items-center">
                                                        {req.created_at || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Existing API Key from Associated Account */}
                                            {(() => {
                                                const apiKey = associatedAccount?.nola_pro_api_key || associatedAccount?.api_key || associatedAccount?.semaphore_api_key;
                                                return associatedAccount && apiKey && (
                                                    <div className="pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Current API Key</p>
                                                            <button 
                                                                onClick={(e) => { e.preventDefault(); setShowApiKey(!showApiKey); }}
                                                                className="text-[11px] text-[#2b83fa] font-semibold hover:underline"
                                                            >
                                                                {showApiKey ? "Hide" : "Show"}
                                                            </button>
                                                        </div>
                                                        <p className="text-[13px] font-mono text-[#111111] dark:text-white bg-white dark:bg-[#1a1b1e] p-2.5 rounded-lg border border-[#e5e5e5] dark:border-white/5 break-all">
                                                            {showApiKey ? apiKey : "••••••••••••••••••••••••••••••••••••••••••••••"}
                                                        </p>
                                                    </div>
                                                );
                                            })()}

                                            {req.purpose && (
                                                <div className="pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                                    <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Purpose</p>
                                                    <p className="text-[13px] text-[#111111] dark:text-white leading-relaxed">{req.purpose}</p>
                                                </div>
                                            )}
                                            
                                            {req.sample_message && (
                                                <div className="pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                                    <p className="text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1">Sample Message</p>
                                                    <p className="text-[13px] text-[#111111] dark:text-white italic bg-white dark:bg-[#1a1b1e] p-3 rounded-lg border border-[#e5e5e5] dark:border-white/5">"{req.sample_message}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Pending: Approve & Activate / Reject ── */}
                                        {req.status === 'pending' && (
                                            <div className="space-y-4 pt-4 border-t border-[#e5e5e5] dark:border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="h-6 w-1 bg-[#2b83fa] rounded-full"></div>
                                                    <h4 className="text-[12px] font-black text-[#111111] dark:text-white uppercase tracking-wider">Admin Review Action</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {/* API Key for Approval */}
                                                    <div>
                                                    <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Semaphore API Key</label>
                                                    <div className="relative">
                                                        <input
                                                            type={showInputKey ? "text" : "password"}
                                                            value={apiKeyInput}
                                                            onChange={e => setApiKeyInput(e.target.value)}
                                                            placeholder="Enter Semaphore API Key..."
                                                            className="w-full pl-4 pr-12 py-3 text-[13px] rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow font-mono"
                                                        />
                                                        <button 
                                                            type="button"
                                                            onClick={() => setShowInputKey(!showInputKey)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                                        >
                                                            {showInputKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                    {/* Optional Rejection Note */}
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Rejection Note (Optional)</label>
                                                        <textarea
                                                            value={rejectNote}
                                                            onChange={e => setRejectNote(e.target.value)}
                                                            rows={2}
                                                            placeholder="Reason for rejection..."
                                                            className="w-full px-4 py-2.5 text-[12px] rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none transition-shadow h-[40px]"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Action Buttons - Equal Size */}
                                                <div className="grid grid-cols-2 gap-3 pt-2">
                                                    <button
                                                        disabled={!apiKeyInput.trim() || !!isActing}
                                                        onClick={() => doAction('approved', req.id, { api_key: apiKeyInput.trim() })}
                                                        className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm disabled:opacity-50 disabled:shadow-none"
                                                    >
                                                        <FiCheck className="w-4 h-4" />
                                                        <span>Approve</span>
                                                    </button>
                                                    <button
                                                        disabled={!!isActing}
                                                        onClick={() => doAction('rejected', req.id, { rejection_note: rejectNote })}
                                                        className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/10 dark:hover:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30 transition-all disabled:opacity-50"
                                                    >
                                                        <FiX className="w-4 h-4" />
                                                        <span>Reject</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Approved: show confirmation ── */}
                                        {req.status === 'approved' && (
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                                    <FiCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <p className="text-[13px] text-emerald-700 dark:text-emerald-400 font-medium leading-snug">
                                                    Sender ID is active. User can send messages via <strong>{req.requested_id}</strong>.
                                                </p>
                                            </div>
                                        )}

                                        {/* ── Approved/Rejected: show account key toggle if available ── */}
                                        {(() => {
                                            const apiKey = associatedAccount?.nola_pro_api_key || associatedAccount?.api_key || associatedAccount?.semaphore_api_key;
                                            return (req.status === 'approved' || req.status === 'rejected') && associatedAccount && apiKey && (
                                                <div className="pt-4 border-t border-[#e5e5e5] dark:border-white/5 mt-4">
                                                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#f7f7f7] dark:bg-[#111214] border border-[#e5e5e5] dark:border-white/5">
                                                        <span className="text-[13px] font-medium text-[#6e6e73] dark:text-[#9aa0a6] whitespace-nowrap">Account API Key</span>
                                                        
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[14px] font-mono text-[#2b83fa] dark:text-[#4da3ff] truncate max-w-[200px] md:max-w-none">
                                                                {showApiKey 
                                                                    ? apiKey 
                                                                    : apiKey.length > 12 
                                                                        ? `${apiKey.substring(0, 6)}•••${apiKey.substring(apiKey.length - 6)}`
                                                                        : '••••••••••••'}
                                                            </span>
                                                            
                                                            <div className="flex items-center gap-1.5 pl-3 border-l border-[#e5e5e5] dark:border-white/10">
                                                                <button 
                                                                    onClick={(e) => { e.preventDefault(); setShowApiKey(!showApiKey); }}
                                                                    className="text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"
                                                                    title={showApiKey ? 'Hide Key' : 'Show Key'}
                                                                >
                                                                    {showApiKey ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                                                                </button>
                                                                <button 
                                                                    onClick={async (e) => {
                                                                        e.preventDefault();
                                                                        await navigator.clipboard.writeText(apiKey || '');
                                                                    }}
                                                                    className="text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"
                                                                    title="Copy API Key"
                                                                >
                                                                    <FiCopy size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Admin Users Management View ──────────────────────────────────────────────

export const AdminTeamManagement: React.FC = () => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('support');
    const [actionLoading, setActionLoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchAdmins = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const res = await fetch('/api/admin_users.php');
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success') setAdmins(json.data || []);
                else setError(json.message || 'Failed to fetch admin users.');
            } else {
                setAdmins([{ username: 'admin', role: 'super_admin', created_at: new Date().toISOString().split('T')[0], active: true }]);
            }
            setLastRefreshed(new Date());
        } catch {
            setAdmins([{ username: 'admin', role: 'super_admin', created_at: new Date().toISOString().split('T')[0], active: true }]);
        } finally { if (isInitial) setLoading(false); }
    }, []);

    useEffect(() => {
        fetchAdmins(true);
        const timer = setInterval(() => fetchAdmins(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchAdmins]);

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin_users.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
            });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success') {
                    setSuccessMsg('Admin user created successfully.');
                    setShowCreateModal(false);
                    setNewUsername(''); setNewPassword(''); setNewRole('support');
                    fetchAdmins();
                } else { setError(json.message || 'Failed to create admin.'); }
            } else {
                setSuccessMsg('Admin user created successfully (Mocked).');
                setAdmins(prev => [...prev, { username: newUsername, role: newRole, created_at: new Date().toISOString().split('T')[0], active: true }]);
                setShowCreateModal(false);
            }
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch { setError('Network error creating admin.'); }
        finally { setActionLoading(false); }
    };

    const handleDeleteAdmin = async (usernameToDelete: string) => {
        if (!confirm(`Are you sure you want to delete '${usernameToDelete}'?`)) return;
        setActionLoading(true); setActionMenuId(null);
        try {
            const res = await fetch('/api/admin_users.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameToDelete })
            });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success') { setSuccessMsg(`Admin ${usernameToDelete} deleted.`); fetchAdmins(); }
                else setError(json.message || 'Failed to delete admin.');
            } else {
                setSuccessMsg(`Admin ${usernameToDelete} deleted (Mocked).`);
                setAdmins(prev => prev.filter(a => a.username !== usernameToDelete));
            }
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch { setError('Network error deleting admin.'); }
        finally { setActionLoading(false); }
    };

    const getRoleBadge = (role: string) => {
        const map: Record<string, { bg: string; label: string }> = {
            super_admin: { bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30', label: 'Super Admin' },
            support:     { bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800/30', label: 'Support' },
            viewer:      { bg: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/10 dark:text-gray-400 dark:border-gray-800/30', label: 'Viewer' },
        };
        const style = map[role] || map.viewer;
        return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${style.bg}`}>{style.label || role}</span>;
    };

    const filtered = admins.filter(a =>
        a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-end mb-2">
                {!loading && <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">Last Active: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Admin Users</h3>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Manage dashboard access and role permissions.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-xl font-bold text-[13px] hover:bg-[#333333] dark:hover:bg-[#e5e5e5] transition-colors">
                    <FiPlus className="w-4 h-4" /> Create Admin
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] w-3.5 h-3.5" />
                <input type="text" placeholder="Search by username or role..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 text-[12px] text-[#111111] dark:text-white placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all font-medium"
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"><FiX className="w-3 h-3" /></button>}
            </div>

            {successMsg && <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400 text-[13px] font-medium"><FiCheck className="w-4 h-4 flex-shrink-0" /> {successMsg}</div>}
            {error && <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium"><FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[#e5e5e5] dark:border-white/10 text-[11px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] uppercase tracking-wider">
                            <th className="pb-3 pl-2">Username</th>
                            <th className="pb-3">Role</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3">Created</th>
                            <th className="pb-3">Last Login</th>
                            <th className="pb-3 text-right pr-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0] dark:divide-white/5">
                        {loading ? (
                            <tr><td colSpan={6} className="py-8 text-center"><div className="flex items-center justify-center gap-2 text-[#9aa0a6] text-[13px]"><FiRefreshCw className="w-4 h-4 animate-spin" /> Loading admins...</div></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center"><FiShield className="w-8 h-8 mx-auto mb-2 text-[#d0d0d0] dark:text-[#3a3b3f]" /><p className="text-[13px] text-[#9aa0a6] font-medium">{searchTerm ? 'No admins match your search.' : 'No admin users found.'}</p></td></tr>
                        ) : filtered.map(admin => (
                            <tr key={admin.username} className="group hover:bg-[#f7f7f7] dark:hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 pl-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center text-white text-[11px] font-black flex-shrink-0">{admin.username?.charAt(0).toUpperCase()}</div>
                                        <span className="font-bold text-[14px] text-[#111111] dark:text-white">{admin.username}</span>
                                    </div>
                                </td>
                                <td className="py-3.5">{getRoleBadge(admin.role)}</td>
                                <td className="py-3.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${admin.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30' : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/10 dark:text-gray-400 dark:border-gray-800/30'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${admin.active !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                        {admin.active !== false ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="py-3.5 text-[13px] text-[#6e6e73] dark:text-[#9aa0a6]">{admin.created_at || '—'}</td>
                                <td className="py-3.5 text-[13px] text-[#6e6e73] dark:text-[#9aa0a6]">
                                    {admin.last_login ? new Date(admin.last_login).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="italic opacity-50">Never</span>}
                                </td>
                                <td className="py-3.5 pr-2 text-right">
                                    <div className="relative inline-block">
                                        <button onClick={() => setActionMenuId(actionMenuId === admin.username ? null : admin.username)} className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#f0f0f0] dark:hover:bg-white/5 transition-colors">
                                            <FiMoreVertical className="w-4 h-4" />
                                        </button>
                                        {actionMenuId === admin.username && (
                                            <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-[#1e2023] border border-[#e5e5e5] dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 fade-in duration-100">
                                                <button onClick={() => { alert('Reset password endpoint required on backend.'); setActionMenuId(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 hover:text-[#111111] dark:hover:text-white transition-colors text-left">
                                                    <FiKey className="w-3.5 h-3.5" /> Reset Password
                                                </button>
                                                <button onClick={() => { alert('Toggle status endpoint required on backend.'); setActionMenuId(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 hover:text-amber-600 transition-colors text-left">
                                                    <FiToggleLeft className="w-3.5 h-3.5" /> Toggle Status
                                                </button>
                                                <div className="border-t border-[#f0f0f0] dark:border-white/5" />
                                                <button onClick={() => handleDeleteAdmin(admin.username)} disabled={actionLoading} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left disabled:opacity-50">
                                                    <FiTrash2 className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Admin Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[18px] font-bold text-[#111111] dark:text-white">Create Admin</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors"><FiX className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">Username</label>
                                <input required value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. nola_admin"
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" />
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">Initial Password</label>
                                <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Secure password"
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" />
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">Role</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow">
                                    <option value="super_admin">Super Admin</option>
                                    <option value="support">Support</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={actionLoading || !newUsername.trim() || !newPassword.trim()}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-[14px] font-bold text-[14px] transition-all shadow-md active:scale-[0.98] disabled:opacity-50">
                                    {actionLoading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Admin Accounts View ─────────────────────────────────────────────────────

const AdminAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    
    // Manage Sender States
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleApiKeyId, setVisibleApiKeyId] = useState<string | null>(null);
    const [managingAccount, setManagingAccount] = useState<Account | null>(null);
    const [manageSenderId, setManageSenderId] = useState('');
    const [manageApiKey, setManageApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchAccounts = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${ADMIN_API}?action=accounts`);
            const json = await res.json();
            if (json.status === 'success') {
                const mappedAccounts = (json.data || []).map((item: any) => {
                    if (item.data) return { id: item.id, ...item.data };
                    return item;
                }).filter((acc: any) => acc.id !== 'ghl' && acc.location_id);
                
                setAccounts(mappedAccounts);
            } else {
                setError(json.message || 'Failed to load accounts.');
            }
            setLastRefreshed(new Date());
        } catch {
            setError('Network error. Could not reach the backend.');
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts(true);
        const timer = setInterval(() => fetchAccounts(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchAccounts]);

    const submitManageSender = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!managingAccount) return;
        setActionLoading('managing');
        try {
            const res = await fetch(ADMIN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'manage_sender',
                    location_id: managingAccount.location_id,
                    sender_id: manageSenderId,
                    api_key: manageApiKey
                }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setSuccessMsg(json.message || 'Sender ID updated successfully.');
                setManagingAccount(null);
                setTimeout(() => setSuccessMsg(null), 3000);
                fetchAccounts();
            } else {
                setError(json.message || 'Failed to update sender.');
            }
        } catch {
            setError('Network error during update.');
        } finally {
            setActionLoading(null);
        }
    };

    const submitRevokeSender = async () => {
        if (!managingAccount) return;
        if (!confirm(`Are you sure you want to revoke the permanent Sender ID for ${managingAccount.location_name || managingAccount.location_id}?`)) return;
        setActionLoading('managing');
        try {
            const res = await fetch(ADMIN_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'revoke_sender',
                    location_id: managingAccount.location_id
                }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setSuccessMsg(json.message || 'Sender ID revoked successfully.');
                setManagingAccount(null);
                setTimeout(() => setSuccessMsg(null), 3000);
                fetchAccounts();
            } else {
                setError(json.message || 'Failed to revoke sender.');
            }
        } catch {
            setError('Network error during revocation.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-end mb-2">
                {!loading && (
                    <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">
                        Last Pull: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">All User Accounts</h3>
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Overview of all mapped GHL subaccounts, credits, and active Sender IDs.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <input 
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 rounded-xl text-[12px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all w-64"
                        />
                    </div>
                    <button onClick={() => fetchAccounts(true)} className="p-2 rounded-xl text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all">
                        <FiRefreshCw className={`w-4 h-4 ${loading && !accounts.length ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {successMsg && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400 text-[13px] font-medium">
                    <FiCheck className="w-4 h-4 flex-shrink-0" /> {successMsg}
                </div>
            )}

            {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)}
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                    <FiUsers className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px] font-semibold">No accounts found.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#e5e5e5] dark:border-white/5">
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Account / Location ID</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Sender ID</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">API Key</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Credits</th>
                                <th className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Free Used</th>
                                <th className="pb-3 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0] dark:divide-white/[0.03]">
                            {(() => {
                                const filteredAccounts = accounts.filter(acc => 
                                    acc.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    acc.location_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    acc.approved_sender_id?.toLowerCase().includes(searchTerm.toLowerCase())
                                );
                                
                                const currentAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                                return currentAccounts.map(acc => (
                                <tr key={acc.id} className="group hover:bg-[#f7f7f7] dark:hover:bg-white/[0.015] transition-colors">
                                    <td className="py-4 pr-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#f0f0f0] dark:bg-white/5 flex items-center justify-center text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6]">
                                                {acc.location_name ? acc.location_name.substring(0, 2).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[13px] text-[#111111] dark:text-white group-hover:text-[#2b83fa] transition-colors">{acc.location_name || '—'}</p>
                                                <p className="text-[10px] text-[#9aa0a6] font-mono mt-0.5">{acc.location_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4">
                                        {acc.approved_sender_id
                                            ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/30 uppercase tracking-wider">{acc.approved_sender_id}</span>
                                            : <span className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest pl-2">System</span>}
                                    </td>
                                    <td className="py-4 pr-4">
                                        {(() => {
                                            const apiKey = acc.nola_pro_api_key || acc.api_key || acc.semaphore_api_key;
                                            return apiKey ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] text-[#2b83fa] dark:text-[#4da3ff] font-mono bg-[#f0f0f0] dark:bg-white/5 px-2 py-1 rounded-md max-w-[120px] truncate">
                                                        {visibleApiKeyId === acc.id 
                                                            ? apiKey 
                                                            : apiKey.length > 12 
                                                                ? `${apiKey.substring(0, 5)}•••${apiKey.substring(apiKey.length - 5)}`
                                                                : '••••••••••••'}
                                                    </span>
                                                    <div className="flex items-center border-l border-[#e5e5e5] dark:border-white/10 pl-1.5 ml-1 gap-1">
                                                        <button 
                                                            onClick={() => setVisibleApiKeyId(visibleApiKeyId === acc.id ? null : acc.id)}
                                                            className="p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"
                                                            title={visibleApiKeyId === acc.id ? 'Hide Key' : 'Show Key'}
                                                        >
                                                            {visibleApiKeyId === acc.id ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                await navigator.clipboard.writeText(apiKey || '');
                                                            }}
                                                            className="p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"
                                                            title="Copy API Key"
                                                        >
                                                            <FiCopy size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-[#9aa0a6] italic pl-2">None</span>
                                            );
                                        })()}
                                    </td>
                                    <td className="py-4 pr-4">
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-[#111111] dark:text-white">{(acc.credit_balance ?? acc.credits ?? 0).toLocaleString()}</span>
                                            <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">Balance</span>
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4">
                                        <div className={`inline-flex flex-col p-1.5 rounded-xl border ${ (acc.free_usage_count ?? 0) >= (acc.free_credits_total ?? 10) ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20' }`}>
                                            <span className={`text-[12px] font-black text-center ${ (acc.free_usage_count ?? 0) >= (acc.free_credits_total ?? 10) ? 'text-red-600 dark:text-red-400' : 'text-[#2b83fa]' }`}>
                                                {acc.free_usage_count ?? 0} / {acc.free_credits_total ?? 10}
                                            </span>
                                            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
                                                <div className={`h-full ${(acc.free_usage_count ?? 0) >= (acc.free_credits_total ?? 10) ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(((acc.free_usage_count ?? 0) / (acc.free_credits_total ?? 10)) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-2 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setManagingAccount(acc);
                                                    setManageSenderId(acc.approved_sender_id || '');
                                                    setManageApiKey(acc.nola_pro_api_key || acc.api_key || acc.semaphore_api_key || '');
                                                }}
                                                className="p-2 rounded-xl text-[#2b83fa] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800/30"
                                                title="Manage Account"
                                            >
                                                <FiSettings className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                    
                    {/* Pagination Controls */}
                    {(() => {
                        const filteredAccounts = accounts.filter(acc => 
                            acc.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            acc.location_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            acc.approved_sender_id?.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
                        if (totalPages <= 1) return null;

                        return (
                            <div className="flex items-center justify-between px-4 py-4 mt-2 border-t border-[#e5e5e5] dark:border-white/5">
                                <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] font-medium">
                                    Showing <span className="font-bold text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}</span> of <span className="font-bold text-[#111111] dark:text-white">{filteredAccounts.length}</span> entries
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="p-1.5 rounded-lg text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <FiChevronLeft className="w-4 h-4" />
                                    </button>
                                    
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center transition-all ${
                                                    currentPage === page
                                                        ? 'bg-[#2b83fa] text-white shadow-sm'
                                                        : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="p-1.5 rounded-lg text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <FiChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Manage Sender Modal */}
            {managingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[18px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                <FiSettings className="text-[#2b83fa]" /> Manage Sender Config
                            </h3>
                            <button onClick={() => setManagingAccount(null)} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-5">
                            Update the permanent Sender ID configuration for <span className="font-semibold text-[#111111] dark:text-white">{managingAccount.location_name || managingAccount.location_id}</span>.
                        </p>

                        <form onSubmit={submitManageSender} className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Approved Sender ID</label>
                                <input
                                    required
                                    value={manageSenderId}
                                    onChange={(e) => setManageSenderId(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                                />
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">API Key</label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showApiKey ? "text" : "password"}
                                        value={manageApiKey}
                                        onChange={(e) => setManageApiKey(e.target.value)}
                                        className="w-full pl-4 pr-24 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 font-mono transition-shadow"
                                    />
                                    <div className="absolute top-[3px] right-[3px] flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="p-2 mr-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                                        >
                                            {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(manageApiKey);
                                                setCopiedKey(true);
                                                setTimeout(() => setCopiedKey(false), 2000);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors border ${
                                                copiedKey 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30' 
                                                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 dark:border-white/10'
                                            }`}
                                        >
                                            {copiedKey ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
                                            {copiedKey ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'managing'}
                                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                >
                                    {actionLoading === 'managing' ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
                                    Save Changes
                                </button>
                                
                                <div className="border-t border-[#e5e5e5] dark:border-white/10 my-1"></div>
                                
                                <button
                                    type="button"
                                    onClick={submitRevokeSender}
                                    disabled={actionLoading === 'managing'}
                                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl font-bold text-[14px] transition-all disabled:opacity-50"
                                >
                                    Revoke Permanent Sender
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};


// ─── System Settings View ─────────────────────────────────────────────────────

const AdminSettings: React.FC = () => {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [senderDefault, setSenderDefault] = useState(() => localStorage.getItem('admin_setting_sender') || 'NOLASMSPro');
    const [freeLimit, setFreeLimit] = useState(() => localStorage.getItem('admin_setting_free_limit') || '10');
    const [environment, setEnvironment] = useState(() => localStorage.getItem('admin_setting_env') || 'production');

    const handleSave = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 600));
        localStorage.setItem('admin_setting_sender', senderDefault);
        localStorage.setItem('admin_setting_free_limit', freeLimit);
        localStorage.setItem('admin_setting_env', environment);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const envBadge: Record<string, string> = {
        development: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/30',
        staging:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
        production:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
    };

    const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
        <div className="border border-[#e5e5e5] dark:border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[#f7f7f7] dark:bg-[#111214] border-b border-[#e5e5e5] dark:border-white/5">
                <span className="text-[#2b83fa]">{icon}</span>
                <h4 className="text-[12px] font-black text-[#111111] dark:text-white uppercase tracking-wider">{title}</h4>
            </div>
            <div className="p-5 space-y-5">{children}</div>
        </div>
    );

    const Field = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
        <div>
            <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">{label}</label>
            {children}
            {help && <p className="text-[11px] text-[#9aa0a6] mt-1.5">{help}</p>}
        </div>
    );

    return (
        <div className="space-y-5">
            {saved && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 text-green-700 dark:text-green-400 text-[13px] font-medium animate-in fade-in duration-200">
                    <FiCheck className="w-4 h-4 flex-shrink-0" /> Settings saved successfully.
                </div>
            )}

            {/* General */}
            <Section title="General" icon={<FiSettings className="w-4 h-4" />}>
                <Field label="System Default Sender ID" help="Used as fallback when no custom sender is assigned to an account.">
                    <input value={senderDefault} onChange={e => setSenderDefault(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" />
                </Field>
                <Field label="Free Usage Limit" help="Maximum number of free messages each new account can send before requiring credits.">
                    <input type="number" min={0} value={freeLimit} onChange={e => setFreeLimit(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow" />
                </Field>
            </Section>

            {/* Environment */}
            <Section title="Environment" icon={<FiActivity className="w-4 h-4" />}>
                <Field label="Environment Label" help="Displayed as a badge throughout the admin panel. Does not affect system behavior.">
                    <div className="flex items-center gap-3">
                        <select value={environment} onChange={e => setEnvironment(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl text-[14px] border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow">
                            <option value="development">Development</option>
                            <option value="staging">Staging</option>
                            <option value="production">Production</option>
                        </select>
                        <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border ${envBadge[environment] || envBadge.production}`}>{environment}</span>
                    </div>
                </Field>
            </Section>

            {/* API */}
            <Section title="API" icon={<FiKey className="w-4 h-4" />}>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5">
                    <FiAlertCircle className="w-4 h-4 text-[#2b83fa] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] leading-relaxed">
                        Per-account API keys are managed in the <strong className="text-[#111111] dark:text-white">All Accounts</strong> tab. Global API configuration requires direct backend access. Contact your system administrator.
                    </p>
                </div>
            </Section>

            {/* Security */}
            <Section title="Security" icon={<FiShield className="w-4 h-4" />}>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
                    <FiLock className="w-4 h-4 text-[#2b83fa] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] leading-relaxed">
                        Admin session is stored in browser localStorage. For advanced security features (IP whitelisting, 2FA, audit logs), backend configuration is required.
                    </p>
                </div>
            </Section>

            <button onClick={handleSave} disabled={saving}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-70">
                {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : saved ? <FiCheck className="w-4 h-4" /> : null}
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
            </button>
        </div>
    );
};


const AdminLogs: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'message' | 'sender_request' | 'credit_purchase' | 'credit_usage'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [copiedContent, setCopiedContent] = useState(false);
    const ITEMS_PER_PAGE = 10;
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterType]);

    const fetchLogs = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError(null);
        try {
            const [logsRes, accsRes] = await Promise.all([
                fetch(`${ADMIN_API}?action=logs`),
                fetch(`${ADMIN_API}?action=accounts`)
            ]);
            const logsData = await logsRes.json();
            const accsData = await accsRes.json();
            
            if (logsData.status === 'success') setLogs(logsData.data || []);
            else setError(logsData.message || 'Failed to load logs.');
            
            if (accsData.status === 'success') {
                const mapped = (accsData.data || []).map((item: any) => item.data ? { id: item.id, ...item.data } : item);
                setAccounts(mapped);
            }
            setLastRefreshed(new Date());
        } catch { setError('Network error. Could not reach the backend.'); }
        finally { if (isInitial) setLoading(false); }
    }, []);

    useEffect(() => {
        fetchLogs(true);
        const t = setInterval(() => fetchLogs(false), POLL_INTERVAL);
        return () => clearInterval(t);
    }, [fetchLogs]);

    const getType = (log: any) => {
        if (log.type === 'message' && log.amount === undefined) return 'message';
        
        const neg = (typeof log.amount === 'number' && log.amount < 0) || (typeof log.amount === 'string' && log.amount.startsWith('-'));
        if (neg || log.type === 'deduction' || log.type === 'credit_usage') return 'credit_usage';
        if (log.amount !== undefined || log.type === 'top_up' || log.type === 'credit_purchase') return 'credit_purchase';
        
        return log.type || 'message';
    };

    const filtered = logs.filter(log => {
        const type = getType(log);
        if (filterType !== 'all' && type !== filterType) return false;
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            const s = [log.number, log.to, log.message, log.requested_id, log.location_id, log.sendername, log.status].filter(Boolean).join(' ').toLowerCase();
            if (!s.includes(q)) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const currentLogs = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const pills = [
        { id: 'all', label: 'All', color: 'blue' },
        { id: 'message', label: 'SMS History', icon: <FiMessageSquare size={11} />, color: 'blue' },
        { id: 'credit_purchase', label: 'Credits Added', icon: <FiCreditCard size={11} />, color: 'emerald' },
        { id: 'credit_usage', label: 'Credits Used', icon: <FiActivity size={11} />, color: 'purple' },
    ] as const;

    const pillColors: Record<string, { active: string; inactive: string }> = {
        blue:    { active: 'bg-blue-600 text-white border-transparent shadow-sm',    inactive: 'bg-blue-50/50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/10 hover:opacity-100' },
        amber:   { active: 'bg-amber-500 text-white border-transparent shadow-sm',   inactive: 'bg-amber-50/50 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/10 hover:opacity-100' },
        emerald: { active: 'bg-emerald-600 text-white border-transparent shadow-sm', inactive: 'bg-emerald-50/50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/10 hover:opacity-100' },
        purple:  { active: 'bg-purple-600 text-white border-transparent shadow-sm',  inactive: 'bg-purple-50/50 dark:bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/10 hover:opacity-100' },
    };

    const statusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        const map: Record<string, string> = {
            sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
            delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
            pending: 'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
            queued: 'bg-blue-50 text-[#2b83fa] border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30',
            failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
            rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30',
            approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30',
        };
        return <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${map[s] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/10 dark:text-gray-400 dark:border-gray-800/30'}`}>{status}</span>;
    };

    const renderRow = (log: any, isModal = false) => {
        const type = getType(log);
        const ts = log.timestamp || log.date_created || log.created_at;
        const date = ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const time = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        const base = `group flex items-center gap-4 p-4 rounded-[16px] border transition-all duration-300 ${isModal ? 'border-transparent bg-transparent' : 'bg-white dark:bg-[#1a1b1e] border-[#e5e5e5] dark:border-white/10 hover:border-[#2b83fa]/40 dark:hover:border-[#2b83fa]/50 hover:shadow-lg dark:hover:shadow-[#2b83fa]/5 cursor-pointer hover:-translate-y-1'}`;

        const locId = log.location_id || log.account_id;
        const account = accounts.find(a => a.id === locId || a.location_id === locId);
        
        const subAccountPill = locId ? (
            <div className="flex items-center gap-1.5 bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 pl-1 pr-2 py-0.5 rounded-full" title={account?.location_name || 'Unknown Account'}>
                <div className="w-4 h-4 rounded-full bg-[#e5e5e5] dark:bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-500">
                    {account?.location_name ? account.location_name.substring(0, 1).toUpperCase() : '?'}
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[80px]">{account?.location_name || 'System'}</span>
                    <span className="text-[9px] font-mono text-gray-400">({locId.substring(0, 5)})</span>
                </div>
            </div>
        ) : null;

        if (type === 'message') {

            return (
                <div key={log.id} className={base} onClick={() => !isModal && setSelectedLog(log)}>
                    <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 bg-blue-50 dark:bg-blue-900/20 text-[#2b83fa] dark:text-[#569cfe]`}>
                        <FiMessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1 gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <p className="text-[14px] font-bold text-[#111111] dark:text-white truncate">
                                    To <span className="font-mono text-[13px] ml-1">{log.number || log.to || 'Unknown'}</span>
                                </p>
                                <div className="flex-shrink-0 scale-90 origin-left">{statusBadge(log.status || 'unknown')}</div>
                            </div>
                            <div className="text-right flex-shrink-0"><span className="block text-[11px] font-bold text-[#111111] dark:text-white">{date}</span><span className="block text-[10px] uppercase text-[#9aa0a6]">{time}</span></div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] truncate flex-1">{log.message || 'No content'}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
                                {log.sendername && <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-1.5 py-0.5 rounded">Via: {log.sendername}</span>}
                                {subAccountPill}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }



        if (type === 'credit_purchase' || type === 'credit_usage') {
            const isUsage = type === 'credit_usage' || (typeof log.amount === 'number' && log.amount < 0);
            return (
                <div key={log.id} className={base} onClick={() => !isModal && setSelectedLog(log)}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 ${isUsage ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                        {isUsage ? <FiActivity className="w-5 h-5" /> : <FiCreditCard className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1 gap-2">
                            <p className="text-[14px] font-bold text-[#111111] dark:text-white">{isUsage ? 'Credits Used' : 'Credits Purchased'}</p>
                            <div className="text-right flex-shrink-0"><span className="block text-[11px] font-bold text-[#111111] dark:text-white">{date}</span><span className="block text-[10px] uppercase text-[#9aa0a6]">{time}</span></div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] truncate flex-1">{isUsage ? 'Deducted' : 'Added'} <span className={`font-bold ${isUsage ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{!isUsage && '+'}{log.amount?.toLocaleString()}</span> credits</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80">
                                {log.status && <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800/30">{log.status === 'completed' ? 'Paid' : log.status}</span>}
                                {subAccountPill}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_15px_rgba(0,0,0,0.2)]">
            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-[#e5e5e5] dark:border-white/5">
                <div className="flex items-center justify-end mb-2">
                    {!loading && (
                        <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">
                            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div>
                        <h3 className="text-[16px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                            <FiActivity className="w-4 h-4 text-[#2b83fa]" /> Platform Activity
                        </h3>
                        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">Platform-wide activity logs across all accounts.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 text-[12px] text-[#111111] dark:text-white placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all font-medium"
                            />
                            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors"><FiX className="w-3 h-3" /></button>}
                        </div>
                        <button onClick={() => fetchLogs(true)} className="p-2 text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all border border-[#e5e5e5] dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0d0e10] rounded-xl flex-shrink-0">
                            <FiRefreshCw className={`w-3.5 h-3.5 ${loading && !logs.length ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Type Pill Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {pills.map(pill => {
                        const isActive = filterType === pill.id;
                        const theme = pillColors[pill.color];
                        const count = pill.id === 'all' ? logs.length : logs.filter(l => getType(l) === pill.id).length;
                        return (
                            <button key={pill.id} onClick={() => { setFilterType(pill.id as any); setCurrentPage(1); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border opacity-80 hover:opacity-100 ${ isActive ? theme.active : theme.inactive }`}
                            >
                                {'icon' in pill ? pill.icon : null}
                                <span>{pill.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[18px] text-center ${isActive ? 'bg-white/20' : 'opacity-60'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div className="p-6">
                {error && <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[13px] font-medium"><FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</div>}

                {loading ? (
                    <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-[76px] rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)}</div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center">
                        <FiActivity className="w-12 h-12 mx-auto mb-4 text-[#d0d0d0] dark:text-[#3a3b3f]" />
                        <h3 className="text-[15px] font-bold text-[#111111] dark:text-white mb-1">No Logs Found</h3>
                        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6]">{debouncedSearch || filterType !== 'all' ? 'Try adjusting your filters.' : 'Platform logs will appear here as activity occurs.'}</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 pb-2">{currentLogs.map(log => renderRow(log))}</div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#e5e5e5] dark:border-white/5">
                                <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] font-medium">
                                    Showing <b className="text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b> – <b className="text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</b> of <b className="text-[#111111] dark:text-white">{filtered.length}</b>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronLeft className="w-4 h-4" /></button>
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        const page = totalPages <= 7 ? i + 1 : currentPage <= 4 ? i + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + i : currentPage - 3 + i;
                                        return <button key={page} onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-[#2b83fa] text-white shadow-sm' : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5'}`}>{page}</button>;
                                    })}
                                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (() => {
                const log = selectedLog;
                const type = getType(log);
                const ts = log.timestamp || log.date_created || log.created_at;
                const dtStr = ts ? new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white/95 dark:bg-[#1a1b1e]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[24px] p-7 w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">
                                    {type === 'message' ? 'Message Detail' : type === 'sender_request' ? 'Sender Request Detail' : 'Credit Event Detail'}
                                </h3>
                                <button onClick={() => setSelectedLog(null)} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors"><FiX className="w-5 h-5" /></button>
                            </div>

                            {type === 'message' && (
                                <div className="space-y-4">
                                    <div className="bg-[#f7f7f7] dark:bg-[#111214] rounded-xl p-4 border border-[#e5e5e5] dark:border-white/5 space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1">Recipient</p><p className="text-[13px] font-mono font-bold text-[#111111] dark:text-white">{log.number || log.to || '—'}</p></div>
                                            <div><p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1">Status</p>{statusBadge(log.status || 'unknown')}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#e5e5e5] dark:border-white/5">
                                            <div><p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1">Sender Name</p><p className="text-[13px] font-mono text-[#111111] dark:text-white">{log.sendername || 'System'}</p></div>
                                            <div><p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1">Date</p><p className="text-[13px] text-[#111111] dark:text-white">{dtStr}</p></div>
                                        </div>
                                        {log.location_id && <div className="pt-3 border-t border-[#e5e5e5] dark:border-white/5"><p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-1">Location ID</p><p className="text-[12px] font-mono text-[#6e6e73] dark:text-[#9aa0a6]">{log.location_id}</p></div>}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest">Message Content</p>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(log.message || ''); setCopiedContent(true); setTimeout(() => setCopiedContent(false), 2000); }}
                                                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors border ${copiedContent ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30' : 'text-[#6e6e73] border-[#e5e5e5] dark:border-white/5 hover:border-[#d0d0d0]'}`}
                                            >
                                                {copiedContent ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />} {copiedContent ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                        <div className="bg-[#f7f7f7] dark:bg-[#111214] rounded-xl p-4 border border-[#e5e5e5] dark:border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                                            <p className="text-[13px] text-[#111111] dark:text-white leading-relaxed whitespace-pre-wrap">{log.message || 'No content'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {type !== 'message' && <div className="mt-2">{renderRow(log, true)}</div>}

                            <button onClick={() => setSelectedLog(null)} className="mt-6 w-full py-3.5 text-[14px] font-bold text-center text-[#111111] dark:text-white bg-[#f7f7f7] dark:bg-white/5 hover:bg-[#efefef] dark:hover:bg-white/10 transition-colors rounded-xl border border-[#e5e5e5] dark:border-white/5">
                                Close
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

