// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheck, FiClock, FiEye, FiEyeOff, FiKey, FiLock, FiRefreshCw, FiShield, FiToggleLeft, FiUser, FiX } from 'react-icons/fi';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { useToast } from '../../hooks/useToast';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const USERS_API = '/api/admin_users.php';
const REMEMBER_KEY = 'nola_admin_remember';

const decodeJwt = (token: string) => {
    try {
        const payload = token.split('.')[1];
        if (!payload) return {};
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        return JSON.parse(atob(padded));
    } catch {
        return {};
    }
};

const formatDateTime = (value?: string | number) => {
    if (!value) return 'Not available';
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const roleLabel = (role?: string) => (role || 'viewer').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

export const AdminProfile: React.FC = () => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingPassword, setSavingPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const { toasts, showToast, dismissToast } = useToast();

    const token = sessionStorage.getItem('nola_admin_token') || localStorage.getItem('nola_admin_token') || '';
    const storedUser = sessionStorage.getItem('nola_admin_user') || localStorage.getItem('nola_admin_user') || '';
    const claims = useMemo(() => decodeJwt(token), [token]);
    const email = String(claims.email || claims.username || storedUser || '').toLowerCase();
    const currentAdmin = admins.find(admin => String(admin.email || admin.username || '').toLowerCase() === email);
    const displayRole = currentAdmin?.role || claims.role || 'viewer';
    const isRemembered = localStorage.getItem(REMEMBER_KEY) === 'true';
    const expiresAt = claims.exp ? formatDateTime(claims.exp) : 'Session only';
    const issuedAt = claims.iat ? formatDateTime(claims.iat) : 'Not available';

    useEffect(() => {
        let cancelled = false;
        const fetchAdmin = async () => {
            setLoading(true);
            try {
                const res = await adminFetch(USERS_API, { headers: getAdminAuthHeaders() });
                const json = await res.json().catch(() => ({}));
                if (!cancelled && res.ok && json.status === 'success') {
                    setAdmins(json.data || []);
                }
            } catch {
                // Profile remains useful from the active session token.
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchAdmin();
        return () => { cancelled = true; };
    }, []);

    const handlePasswordReset = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.length < 8) {
            showToast('Use at least 8 characters for the new password.', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }
        setSavingPassword(true);
        try {
            const res = await adminFetch(USERS_API, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ action: 'reset_password', email, new_password: password }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.status !== 'success') {
                throw new Error(json.message || 'Password update failed.');
            }
            setPassword('');
            setConfirmPassword('');
            showToast('Password updated successfully.', 'success');
        } catch (error: any) {
            showToast(error.message || 'Could not update password.', 'error');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="space-y-5">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#e5e5e5] dark:border-white/5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] text-white flex items-center justify-center text-[24px] font-black shadow-sm">
                                {(email || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[20px] font-black text-[#111111] dark:text-white truncate">{email || 'Admin account'}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30 text-[10px] font-black uppercase tracking-wider">
                                        <FiShield className="w-3 h-3" /> {roleLabel(displayRole)}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${currentAdmin?.active === false ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30' : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/30'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${currentAdmin?.active === false ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                        {currentAdmin?.active === false ? 'Inactive' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-right">
                            <div className="rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-[#9aa0a6]">Session</p>
                                <p className="text-[13px] font-bold text-[#111111] dark:text-white mt-1">{isRemembered ? 'Remembered' : 'Browser session'}</p>
                            </div>
                            <div className="rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-[#9aa0a6]">Token Expiry</p>
                                <p className="text-[13px] font-bold text-[#111111] dark:text-white mt-1">{expiresAt}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
                    <div className="p-6 space-y-5">
                        <div>
                            <h4 className="text-[13px] font-black text-[#111111] dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FiUser className="w-4 h-4 text-[#2b83fa]" /> Account Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    ['Email', email || 'Not available'],
                                    ['Role', roleLabel(displayRole)],
                                    ['Created', formatDateTime(currentAdmin?.created_at)],
                                    ['Last Login', formatDateTime(currentAdmin?.last_login)],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-[#9aa0a6]">{label}</p>
                                        <p className="text-[13px] font-bold text-[#111111] dark:text-white mt-1 break-words">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[13px] font-black text-[#111111] dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FiLock className="w-4 h-4 text-[#2b83fa]" /> Authentication
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { label: 'Issued', value: issuedAt, icon: <FiClock /> },
                                    { label: 'Remember Me', value: isRemembered ? 'Enabled' : 'Disabled', icon: <FiToggleLeft /> },
                                    { label: 'Profile Source', value: currentAdmin ? 'Admin directory' : 'Session token', icon: loading ? <FiRefreshCw className="animate-spin" /> : <FiShield /> },
                                ].map(item => (
                                    <div key={item.label} className="rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 px-4 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[#9aa0a6]">{item.label}</p>
                                            <span className="text-[#2b83fa]">{item.icon}</span>
                                        </div>
                                        <p className="text-[13px] font-bold text-[#111111] dark:text-white mt-1">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t lg:border-t-0 lg:border-l border-[#e5e5e5] dark:border-white/5 bg-[#fafafa] dark:bg-[#111214]">
                        <h4 className="text-[13px] font-black text-[#111111] dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FiKey className="w-4 h-4 text-[#2b83fa]" /> Change Password
                        </h4>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={event => setPassword(event.target.value)}
                                        minLength={8}
                                        className="w-full px-4 pr-11 py-2.5 rounded-xl text-[14px] border bg-white dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                                        placeholder="At least 8 characters"
                                    />
                                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white">
                                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={event => setConfirmPassword(event.target.value)}
                                        minLength={8}
                                        className="w-full px-4 pr-11 py-2.5 rounded-xl text-[14px] border bg-white dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                                        placeholder="Re-enter password"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white">
                                        {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={savingPassword || !password || !confirmPassword}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] text-white text-[13px] font-bold shadow-md shadow-blue-500/20 hover:shadow-[0_8px_25px_rgba(43,131,250,0.35)] disabled:opacity-50 transition-all"
                            >
                                {savingPassword ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
                                {savingPassword ? 'Updating...' : 'Update Password'}
                            </button>
                            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-3 py-2.5">
                                <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">Password changes apply to this admin account immediately. Keep a recovery path available before rotating credentials.</p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
