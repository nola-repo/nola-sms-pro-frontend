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

const FieldRow = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
    <div>
        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-[#9aa0a6]">
            {label}
        </label>
        <div className="flex min-h-[46px] items-center justify-between gap-3 rounded-xl border border-[#e0e0e0] bg-[#f7f7f7] px-4 py-2.5 text-[13px] font-bold text-[#111111] dark:border-[#ffffff0a] dark:bg-[#0d0e10] dark:text-[#ececf1]">
            <span className="min-w-0 break-words">{value || <span className="font-normal text-[#9aa0a6]">Not available</span>}</span>
            {icon && <span className="shrink-0 text-[#2b83fa]">{icon}</span>}
        </div>
    </div>
);

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
    const displayName = String(currentAdmin?.name || currentAdmin?.full_name || claims.name || email || 'Admin Account')
        .replace(/^[^@]+@.*$/, match => match.split('@')[0])
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
    const initial = (displayName || email || 'A').charAt(0).toUpperCase();
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
        <div className="mx-auto w-full max-w-4xl space-y-5">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                <div className="p-5 sm:p-6">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2b83fa] to-[#1d6bd4] text-[24px] font-black text-white shadow-sm shadow-blue-500/20">
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-[20px] font-black text-[#111111] dark:text-white">{displayName}</h3>
                            <p className="mt-1 truncate text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">{email || 'Admin account'}</p>
                        </div>
                    </div>

                    <div className="space-y-3.5 border-t border-[#f0f0f0] pt-5 dark:border-[#ffffff05]">
                        <FieldRow label="Display Name" value={displayName} icon={<FiUser className="h-4 w-4" />} />
                        <FieldRow label="Email Address" value={email || 'Not available'} />
                        <FieldRow label="Admin Role" value={roleLabel(displayRole)} icon={<FiShield className="h-4 w-4" />} />
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4 dark:border-white/5 dark:bg-[#111214]">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2b83fa]/10 text-[#2b83fa]">
                                <FiLock className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-[14px] font-black text-[#111111] dark:text-white">Account Management</h4>
                                <p className="text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">Session and authentication details</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FieldRow label="Session" value={isRemembered ? 'Remembered' : 'Browser session'} icon={<FiToggleLeft className="h-4 w-4" />} />
                            <FieldRow label="Token Expiry" value={expiresAt} icon={<FiClock className="h-4 w-4" />} />
                            <FieldRow label="Issued" value={issuedAt} />
                            <FieldRow label="Profile Source" value={currentAdmin ? 'Admin directory' : 'Session token'} icon={loading ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiShield className="h-4 w-4" />} />
                            <FieldRow label="Created" value={formatDateTime(currentAdmin?.created_at)} />
                            <FieldRow label="Last Login" value={formatDateTime(currentAdmin?.last_login)} />
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4 dark:border-white/5 dark:bg-[#111214]">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2b83fa]/10 text-[#2b83fa]">
                                <FiKey className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-[14px] font-black text-[#111111] dark:text-white">Change Password</h4>
                                <p className="text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">Update this admin account password</p>
                            </div>
                        </div>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
