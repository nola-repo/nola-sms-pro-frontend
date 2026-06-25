// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiCheck, FiEdit2, FiEye, FiEyeOff, FiLock, FiMoreVertical, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { useToast } from '../../hooks/useToast';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const USERS_API = '/api/admin_users.php';
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

const normalizeIdentity = (value?: unknown) => String(value || '').trim().toLowerCase();

const displayFullName = (value?: unknown, fallback = 'Admin Account') => {
    const source = String(value || fallback).trim();
    const withoutEmailDomain = source.includes('@') ? source.split('@')[0] : source;
    return withoutEmailDomain
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
};

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
    const [, setLoading] = useState(true);
    const [savingPassword, setSavingPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const { toasts, showToast, dismissToast } = useToast();

    const token = sessionStorage.getItem('nola_admin_token') || localStorage.getItem('nola_admin_token') || '';
    const storedUser = sessionStorage.getItem('nola_admin_user') || localStorage.getItem('nola_admin_user') || '';
    const claims = useMemo(() => decodeJwt(token), [token]);
    const email = normalizeIdentity(claims.email || claims.username || storedUser);
    const identityCandidates = [
        claims.email,
        claims.username,
        storedUser,
    ].map(normalizeIdentity).filter(Boolean);
    const currentAdmin = admins.find(admin => [
        admin.email,
        admin.username,
    ].some(value => identityCandidates.includes(normalizeIdentity(value))));
    const displayRole = currentAdmin?.role || claims.role || 'viewer';
    const displayName = displayFullName(currentAdmin?.full_name || currentAdmin?.name || claims.full_name || claims.name || claims.display_name || email);
    const displayPhone = currentAdmin?.phone || currentAdmin?.phone_number || claims.phone || '';
    const initial = (displayName || email || 'A').charAt(0).toUpperCase();

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

    useEffect(() => {
        if (!profileMenuOpen) return;
        const handler = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [profileMenuOpen]);

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
            setPasswordPanelOpen(false);
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
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[20px] font-black text-[#111111] dark:text-white">{displayName}</h3>
                            <p className="mt-1 truncate text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]">{email || 'Admin account'}</p>
                        </div>
                        <div className="relative" ref={profileMenuRef}>
                            <button
                                type="button"
                                onClick={() => setProfileMenuOpen(open => !open)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-[#f5f5f6] text-[#6e6e73] transition-all hover:border-[#2b83fa]/30 hover:text-[#2b83fa] dark:border-white/10 dark:bg-[#0d0e10] dark:text-[#9aa0a6]"
                                aria-label="More profile options"
                                title="More options"
                            >
                                <FiMoreVertical className="h-4 w-4" />
                            </button>
                            {profileMenuOpen && (
                                <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-[#e5e5e5] bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#1a1b1e]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProfileMenuOpen(false);
                                            setPasswordPanelOpen(true);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[#111111] transition-colors hover:bg-[#f5f5f6] dark:text-white dark:hover:bg-white/5"
                                    >
                                        <FiLock className="h-4 w-4 text-[#2b83fa]" />
                                        Change Password
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3.5 border-t border-[#f0f0f0] pt-5 dark:border-[#ffffff05]">
                        <FieldRow label="Full Name" value={displayName} icon={<FiEdit2 className="h-4 w-4" />} />
                        <FieldRow label="Email Address" value={email} icon={<FiEdit2 className="h-4 w-4" />} />
                        <FieldRow label="Phone Number" value={displayPhone} icon={<FiEdit2 className="h-4 w-4" />} />
                        <FieldRow label="Admin Role" value={roleLabel(displayRole)} icon={<FiShield className="h-4 w-4" />} />
                        {currentAdmin?.created_at && <FieldRow label="Created" value={formatDateTime(currentAdmin.created_at)} />}
                        {currentAdmin?.last_login && <FieldRow label="Last Login" value={formatDateTime(currentAdmin.last_login)} />}
                    </div>
                </div>
            </div>

            {passwordPanelOpen && typeof document !== 'undefined' && createPortal((
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setPasswordPanelOpen(false);
                    }}
                >
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-2xl dark:border-white/10 dark:bg-[#1a1b1e]">
                        <div className="flex items-start justify-between gap-4 border-b border-[#f0f0f0] p-5 dark:border-[#ffffff08]">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b83fa]/10 text-[#2b83fa]">
                                    <FiLock className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-[16px] font-black text-[#111111] dark:text-white">Change Password</h3>
                                    <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73] dark:text-[#9aa0a6]">Update the password for this admin account.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPasswordPanelOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#6e6e73] transition-colors hover:bg-[#f5f5f6] hover:text-red-500 dark:text-[#9aa0a6] dark:hover:bg-white/5"
                                aria-label="Close change password modal"
                            >
                                <FiX className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handlePasswordReset} className="space-y-4 p-5">
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    minLength={8}
                                    className="h-11 w-full rounded-xl border border-transparent bg-[#f5f5f6] px-4 pr-10 text-[13px] font-semibold text-[#111111] placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 dark:border-[#ffffff0a] dark:bg-[#0d0e10] dark:text-[#ececf1]"
                                    placeholder="New password"
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#2b83fa]">
                                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={event => setConfirmPassword(event.target.value)}
                                    minLength={8}
                                    className="h-11 w-full rounded-xl border border-transparent bg-[#f5f5f6] px-4 pr-10 text-[13px] font-semibold text-[#111111] placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 dark:border-[#ffffff0a] dark:bg-[#0d0e10] dark:text-[#ececf1]"
                                    placeholder="Confirm password"
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowConfirm(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#2b83fa]">
                                    {showConfirm ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={savingPassword || !password || !confirmPassword}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] text-[12.5px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111111]"
                            >
                                {savingPassword ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
                                Change Password
                            </button>
                            <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 dark:border-amber-800/30 dark:bg-amber-900/10">
                                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <p className="text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">Password changes apply immediately to this admin account.</p>
                            </div>
                        </form>
                    </div>
                </div>
            ), document.body)}
        </div>
    );
};
