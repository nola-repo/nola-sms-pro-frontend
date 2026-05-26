// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FiAlertCircle,
    FiCheck,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiDownload,
    FiEye,
    FiMoreVertical,
    FiMinus,
    FiPlus,
    FiRefreshCw,
    FiSearch,
    FiSettings,
    FiTrash2,
    FiUsers,
    FiX,
} from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { generateMonthlyReport } from '../../utils/pdfGenerator';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';
import { AdminSubaccountProfile } from './AdminSubaccountProfile';

const ADMIN_LIST_USERS_API = '/api/admin_list_users.php';
const ADMIN_MANAGE_USER_API = '/api/admin_manage_user.php';
const ADMIN_SENDER_API = '/api/admin_sender_requests.php';
const POLL_INTERVAL = 15000;
const ITEMS_PER_PAGE = 10;

type Account = {
    id: string;
    name?: string;
    full_name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    active?: boolean;
    location_id?: string;
    active_location_id?: string;
    location_name?: string;
    company_id?: string;
    company_name?: string;
    agency_name?: string;
    source?: string;
    created_at?: string;
    approved_sender_id?: string | null;
    credit_balance?: number;
    credits?: number;
    free_usage_count?: number;
    free_credits_total?: number;
};

const normalizeNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAccount = (item: any): Account => {
    const raw = item?.data ? { id: item.id, ...item.data } : item || {};
    const name = raw.name || raw.full_name || [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim();
    const locationName = raw.location_name || raw.subaccount_name || raw.company_name || '';

    return {
        ...raw,
        id: raw.id || raw.user_id || raw.uid || raw.location_id || raw.email || `user-${Math.random().toString(36).slice(2)}`,
        name: name || raw.email || locationName || 'Unnamed User',
        full_name: raw.full_name || name || raw.email || locationName || 'Unnamed User',
        email: raw.email || raw.email_address || '',
        phone: raw.phone || raw.phone_number || '',
        role: raw.role || 'user',
        active: raw.active !== false,
        location_id: raw.location_id || raw.active_location_id || '',
        active_location_id: raw.active_location_id || raw.location_id || '',
        location_name: locationName,
        agency_name: raw.agency_name || raw.company_name || '',
        credit_balance: normalizeNumber(raw.credit_balance ?? raw.credits, 0),
        credits: normalizeNumber(raw.credits ?? raw.credit_balance, 0),
        free_usage_count: normalizeNumber(raw.free_usage_count, 0),
        free_credits_total: normalizeNumber(raw.free_credits_total, 10),
        approved_sender_id: raw.approved_sender_id || null,
    };
};

const getAccountName = (account: Account) =>
    account.name ||
    account.full_name ||
    [account.firstName, account.lastName].filter(Boolean).join(' ').trim() ||
    account.email ||
    'Unnamed User';

const getInitials = (account: Account) => {
    const source = getAccountName(account);
    const parts = source.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || account.email?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
};

const roleBadge = (role?: string) => {
    const normalized = (role || 'user').replace(/_/g, ' ');
    return (
        <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800/30 text-[10px] font-black uppercase tracking-wider">
            {normalized}
        </span>
    );
};

const emptyValue = (value?: string | null) => value?.trim() || '—';

const getLocationLine = (account: Account) => {
    const locationName = account.location_name?.trim();
    const locationId = (account.location_id || account.active_location_id || '').trim();
    if (locationName && locationId) return `${locationName} - ${locationId}`;
    return locationName || locationId || '';
};

export const AdminAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const [profileAccount, setProfileAccount] = useState<Account | null>(null);
    const [managingAccount, setManagingAccount] = useState<Account | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'reset' | 'delete'; account: Account } | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const [manageSenderId, setManageSenderId] = useState('');
    const [manageCreditBalance, setManageCreditBalance] = useState<number>(0);
    const [manageFreeCreditsTotal, setManageFreeCreditsTotal] = useState<number>(10);

    const [reportTransactions, setReportTransactions] = useState<any[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportSelectedMonth, setReportSelectedMonth] = useState('All');
    const [selectedReportAccount, setSelectedReportAccount] = useState<Account | null>(null);
    const userListUnavailableRef = useRef(false);

    const { toasts, showToast, dismissToast } = useToast();

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        if (!actionMenuId) return;
        const handler = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [actionMenuId]);

    const fetchAccounts = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError(null);

        try {
            if (userListUnavailableRef.current && !isInitial) {
                throw new Error('USER_LIST_SKIPPED_AFTER_401');
            }

            const res = await fetch(ADMIN_LIST_USERS_API, { headers: getAdminAuthHeaders() });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.status !== 'success') {
                const error = new Error(json.message || (res.status === 401 ? 'Admin session was rejected by the user list endpoint.' : 'Failed to load registered users.'));
                (error as any).status = res.status;
                throw error;
            }

            userListUnavailableRef.current = false;
            setAccounts((json.data || []).map(normalizeAccount));
            setLastRefreshed(new Date());
        } catch (primaryError) {
            const primaryStatus = (primaryError as any)?.status;
            if (primaryStatus === 401) {
                userListUnavailableRef.current = true;
            }

            try {
                const legacyRes = await fetch(`${ADMIN_SENDER_API}?action=accounts`, { headers: getAdminAuthHeaders() });
                const legacyJson = await legacyRes.json();
                if (!legacyRes.ok || legacyJson.status !== 'success') throw primaryError;
                setAccounts((legacyJson.data || []).map(normalizeAccount));
                setError(primaryStatus === 401
                    ? 'Admin user list rejected this session (401). Showing legacy account data. Log out and back in if this keeps happening.'
                    : 'User list endpoint is unavailable. Showing legacy account data.');
                setLastRefreshed(new Date());
            } catch {
                setError(primaryError instanceof Error ? primaryError.message : 'Network error. Could not reach the backend.');
            }
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts(true);
        const timer = setInterval(() => fetchAccounts(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchAccounts]);

    const filteredAccounts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return accounts;

        return accounts.filter(acc =>
            getAccountName(acc).toLowerCase().includes(query) ||
            acc.email?.toLowerCase().includes(query) ||
            acc.phone?.toLowerCase().includes(query) ||
            acc.role?.toLowerCase().includes(query) ||
            acc.location_id?.toLowerCase().includes(query) ||
            acc.location_name?.toLowerCase().includes(query) ||
            acc.approved_sender_id?.toLowerCase().includes(query)
        );
    }, [accounts, searchTerm]);

    const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
    const currentAccounts = filteredAccounts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const openActionMenu = (accountId: string, button: HTMLButtonElement) => {
        const rect = button.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        setActionMenuId(prev => prev === accountId ? null : accountId);
    };

    const openManageConfig = (account: Account) => {
        setManagingAccount(account);
        setManageSenderId(account.approved_sender_id || '');
        setManageCreditBalance(account.credit_balance ?? account.credits ?? 0);
        setManageFreeCreditsTotal(account.free_credits_total ?? 10);
        setActionMenuId(null);
        void fetchReportForAccount(account, false);
    };

    const fetchReportForAccount = async (account: Account, showModal = true) => {
        if (!account.location_id) {
            showToast('This account does not have a location ID for reporting.', 'error');
            return;
        }

        if (showModal) setSelectedReportAccount(account);
        setIsLoadingReport(true);
        setReportSelectedMonth('All');
        setReportTransactions([]);

        try {
            const res = await fetch(`/api/get_credit_transactions.php?location_id=${encodeURIComponent(account.location_id)}`, {
                headers: getAdminAuthHeaders(),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setReportTransactions(json.data || []);
            } else {
                showToast(json.message || 'Failed to load transaction history.', 'error');
            }
        } catch {
            showToast('Failed to load transaction history.', 'error');
        } finally {
            setIsLoadingReport(false);
        }
    };

    const submitManageSender = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!managingAccount) return;
        if (!managingAccount.location_id) {
            showToast('This account does not have a location ID.', 'error');
            return;
        }

        setActionLoading('managing');
        try {
            const res = await fetch(ADMIN_SENDER_API, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({
                    action: 'manage_sender',
                    location_id: managingAccount.location_id,
                    sender_id: manageSenderId,
                    credit_balance: manageCreditBalance,
                    free_credits_total: manageFreeCreditsTotal,
                }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                const updated = {
                    ...managingAccount,
                    approved_sender_id: manageSenderId || null,
                    credit_balance: manageCreditBalance,
                    credits: manageCreditBalance,
                    free_credits_total: manageFreeCreditsTotal,
                };
                setAccounts(prev => prev.map(acc => acc.id === managingAccount.id ? updated : acc));
                setManagingAccount(null);
                showToast(json.message || 'Account config updated successfully.', 'success');
                void fetchAccounts(false);
            } else {
                showToast(json.message || 'Failed to update account config.', 'error');
            }
        } catch {
            showToast('Network error during update.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const updateAccountLocally = (accountId: string, patch: Partial<Account>) => {
        setAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, ...patch } : acc));
        setProfileAccount(prev => prev?.id === accountId ? { ...prev, ...patch } : prev);
    };

    const handleManageUserAction = async (type: 'reset' | 'delete', account: Account) => {
        setActionLoading(`${type}:${account.id}`);
        try {
            const res = await fetch(ADMIN_MANAGE_USER_API, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ action: type, user_id: account.id }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || (json?.status && json.status !== 'success')) {
                throw new Error(json?.message || 'Endpoint unavailable.');
            }

            if (type === 'reset') {
                updateAccountLocally(account.id, {
                    credit_balance: 0,
                    credits: 0,
                    free_usage_count: 0,
                    approved_sender_id: null,
                });
            } else {
                setAccounts(prev => prev.filter(acc => acc.id !== account.id));
                if (profileAccount?.id === account.id) setProfileAccount(null);
            }
            showToast(json?.message || `${type === 'reset' ? 'Subaccount reset' : 'Account deleted'} successfully.`, 'success');
        } catch {
            if (type === 'reset') {
                updateAccountLocally(account.id, {
                    credit_balance: 0,
                    credits: 0,
                    free_usage_count: 0,
                    approved_sender_id: null,
                });
                showToast('Reset applied locally while the backend endpoint is pending.', 'info');
            } else {
                setAccounts(prev => prev.filter(acc => acc.id !== account.id));
                if (profileAccount?.id === account.id) setProfileAccount(null);
                showToast('Account removed locally while the backend endpoint is pending.', 'info');
            }
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
            setActionMenuId(null);
        }
    };

    const handleProfileSaved = (updatedAccount: Account) => {
        const normalized = normalizeAccount(updatedAccount);
        setAccounts(prev => prev.map(acc => acc.id === normalized.id ? { ...acc, ...normalized } : acc));
        setProfileAccount(prev => prev?.id === normalized.id ? { ...prev, ...normalized } : prev);
    };

    const handleToggleActive = async (account: Account, active: boolean) => {
        updateAccountLocally(account.id, { active });
        try {
            const res = await fetch(ADMIN_MANAGE_USER_API, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ action: 'toggle_active', user_id: account.id, active }),
            });
            const json = await res.json().catch(() => null);
            if (res.ok && json?.status === 'success') {
                showToast(`Account marked ${active ? 'active' : 'inactive'}.`, 'success');
            } else {
                showToast('Status updated locally while the backend endpoint is pending.', 'info');
            }
        } catch {
            showToast('Status updated locally while the backend endpoint is pending.', 'info');
        }
    };

    const renderFreeUsage = (account: Account) => {
        const used = account.free_usage_count ?? 0;
        const total = account.free_credits_total ?? 10;
        const atLimit = used >= total;
        const percent = Math.min((used / Math.max(total, 1)) * 100, 100);

        return (
            <div className={`inline-flex flex-col p-1.5 rounded-xl border ${atLimit ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20'}`}>
                <span className={`text-[12px] font-black text-center ${atLimit ? 'text-red-600 dark:text-red-400' : 'text-[#2b83fa]'}`}>
                    {used} / {total}
                </span>
                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full ${atLimit ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/5 rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_15px_rgba(0,0,0,0.2)] overflow-hidden">
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />

                <div className="px-6 pt-6 pb-5 border-b border-[#e5e5e5] dark:border-white/5">
                    <div className="flex items-center justify-end mb-2">
                        {!loading && (
                            <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">
                                Synced: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-[16px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                <FiUsers className="w-4 h-4 text-[#2b83fa]" /> Registered Subaccounts
                            </h3>
                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5">
                                Users from the Firestore users collection with profile and credit controls.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-full sm:w-72">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 text-[12px] text-[#111111] dark:text-white placeholder-[#9aa0a6] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all font-medium"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#9aa0a6] hover:text-[#111111] dark:hover:text-white transition-colors">
                                        <FiX className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => fetchAccounts(true)}
                                className="p-2 text-[#6e6e73] hover:text-[#2b83fa] hover:bg-[#2b83fa]/10 transition-all border border-[#e5e5e5] dark:border-white/5 bg-[#f7f7f7] dark:bg-[#0d0e10] rounded-xl flex-shrink-0"
                                title="Refresh users"
                            >
                                <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-[12px] font-medium">
                            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />)}
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                            <FiUsers className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            <p className="text-[14px] font-semibold">No registered users found.</p>
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-[#e5e5e5] dark:border-[#3a3b3f] rounded-xl text-[#9aa0a6] bg-[#f7f7f7] dark:bg-[#0d0e10]">
                            <FiSearch className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            <p className="text-[14px] font-semibold">No users match your search.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[#e5e5e5] dark:border-white/5">
                                        {['Name', 'Email', 'Phone', 'Role', 'Credits', 'Free Used', 'Actions'].map(header => (
                                            <th key={header} className="pb-3 pr-4 text-[11px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider whitespace-nowrap">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0] dark:divide-white/[0.03]">
                                    {currentAccounts.map(account => (
                                        <tr key={account.id} className="group hover:bg-[#f7f7f7] dark:hover:bg-white/[0.015] transition-colors">
                                            <td className="py-4 pr-4 min-w-[300px]">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#2b83fa] to-[#60a5fa] flex items-center justify-center text-white text-[12px] font-black flex-shrink-0 shadow-sm">
                                                        {getInitials(account)}
                                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1a1b1e] ${account.active !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] text-[#111111] dark:text-white group-hover:text-[#2b83fa] transition-colors truncate">{getAccountName(account)}</p>
                                                        <p className="text-[10px] text-[#9aa0a6] font-medium mt-0.5 truncate">{getLocationLine(account) || account.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 pr-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6] min-w-[190px]">{emptyValue(account.email)}</td>
                                            <td className="py-4 pr-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6] min-w-[130px]">{emptyValue(account.phone)}</td>
                                            <td className="py-4 pr-4">{roleBadge(account.role)}</td>
                                            <td className="py-4 pr-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-[#111111] dark:text-white">{(account.credit_balance ?? account.credits ?? 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-[#9aa0a6] font-medium uppercase tracking-tight">Balance</span>
                                                </div>
                                            </td>
                                            <td className="py-4 pr-4">{renderFreeUsage(account)}</td>
                                            <td className="py-4 pr-2 text-right">
                                                <button
                                                    onClick={(event) => openActionMenu(account.id, event.currentTarget)}
                                                    className="p-2 rounded-xl text-[#6e6e73] hover:text-[#111111] dark:hover:text-white hover:bg-white dark:hover:bg-[#1a1b1e] border border-transparent hover:border-[#e5e5e5] dark:hover:border-white/10 hover:shadow-sm transition-all"
                                                    title="Account actions"
                                                >
                                                    <FiMoreVertical className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#e5e5e5] dark:border-white/5">
                                    <div className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6] font-medium">
                                        Showing <b className="text-[#111111] dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b> - <b className="text-[#111111] dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAccounts.length)}</b> of <b className="text-[#111111] dark:text-white">{filteredAccounts.length}</b>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronLeft className="w-4 h-4" /></button>
                                        {Array.from({ length: Math.min(5, totalPages - Math.floor((currentPage - 1) / 5) * 5) }, (_, i) => Math.floor((currentPage - 1) / 5) * 5 + 1 + i).map(page => (
                                            <button key={page} onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-[#2b83fa] text-white shadow-sm' : 'text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f0f0f0] dark:hover:bg-white/5'}`}>{page}</button>
                                        ))}
                                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 rounded-lg text-[#6e6e73] hover:bg-[#f0f0f0] dark:hover:bg-white/5 disabled:opacity-30 transition-colors"><FiChevronRight className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {actionMenuId && (
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                    className="w-52 bg-white dark:bg-[#1e2023] border border-[#e5e5e5] dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-100"
                >
                    {(() => {
                        const account = accounts.find(acc => acc.id === actionMenuId);
                        if (!account) return null;
                        return (
                            <>
                                <button
                                    onClick={() => {
                                        setProfileAccount(account);
                                        setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 hover:text-[#111111] dark:hover:text-white transition-colors text-left"
                                >
                                    <FiEye className="w-3.5 h-3.5" /> View Profile
                                </button>
                                <button
                                    onClick={() => openManageConfig(account)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 hover:text-[#111111] dark:hover:text-white transition-colors text-left"
                                >
                                    <FiSettings className="w-3.5 h-3.5" /> Manage Config
                                </button>
                                <button
                                    onClick={() => {
                                        setActionMenuId(null);
                                        void fetchReportForAccount(account, true);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 hover:text-[#111111] dark:hover:text-white transition-colors text-left"
                                >
                                    <FiDownload className="w-3.5 h-3.5" /> Download Report
                                </button>
                                <div className="border-t border-[#f0f0f0] dark:border-white/5" />
                                <button
                                    onClick={() => {
                                        setConfirmAction({ type: 'reset', account });
                                        setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors text-left"
                                >
                                    <FiRefreshCw className="w-3.5 h-3.5" /> Reset Subaccount
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmAction({ type: 'delete', account });
                                        setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" /> Delete Account
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {profileAccount && (
                <AdminSubaccountProfile
                    account={profileAccount}
                    onClose={() => setProfileAccount(null)}
                    onSaved={handleProfileSaved}
                    onToggleActive={handleToggleActive}
                />
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center mb-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${confirmAction.type === 'delete' ? 'bg-red-100 dark:bg-red-500/20 text-red-500' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300'}`}>
                                {confirmAction.type === 'delete' ? <FiTrash2 className="w-7 h-7" /> : <FiRefreshCw className="w-7 h-7" />}
                            </div>
                        </div>
                        <h3 className="text-[18px] font-bold text-[#111111] dark:text-white text-center mb-3">
                            {confirmAction.type === 'delete' ? 'Delete Account?' : 'Reset Subaccount?'}
                        </h3>
                        <p className="text-[14px] text-[#6e6e73] dark:text-[#9aa0a6] text-center mb-6 leading-relaxed">
                            {confirmAction.type === 'delete'
                                ? `Permanently delete user profile and account for ${getAccountName(confirmAction.account)}?`
                                : `Reset credits, free usage, and sender ID for ${getAccountName(confirmAction.account)}?`}
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 px-4 py-3 text-[14px] font-bold text-[#6e6e73] dark:text-[#9aa0a6] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleManageUserAction(confirmAction.type, confirmAction.account)}
                                disabled={actionLoading === `${confirmAction.type}:${confirmAction.account.id}`}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-bold text-[14px] transition-all disabled:opacity-60 ${
                                    confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
                                }`}
                            >
                                {actionLoading === `${confirmAction.type}:${confirmAction.account.id}` ? (
                                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                                ) : confirmAction.type === 'delete' ? (
                                    <FiTrash2 className="w-4 h-4" />
                                ) : (
                                    <FiRefreshCw className="w-4 h-4" />
                                )}
                                {confirmAction.type === 'delete' ? 'Delete' : 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {managingAccount && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[18px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                <FiSettings className="text-[#2b83fa]" /> Manage Config
                            </h3>
                            <button onClick={() => setManagingAccount(null)} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6] mb-5">
                            Update the credit balance and sender config for <span className="font-semibold text-[#111111] dark:text-white">{getAccountName(managingAccount)}</span>.
                        </p>

                        <form onSubmit={submitManageSender} className="space-y-6">
                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Custom Sender ID</label>
                                <input
                                    value={manageSenderId}
                                    onChange={(event) => setManageSenderId(event.target.value)}
                                    placeholder="System default"
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] font-bold border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                                />
                            </div>

                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Credit Balance</label>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setManageCreditBalance(prev => Math.max(0, prev - 1))} className="w-10 h-10 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] flex items-center justify-center text-[#6e6e73] hover:text-[#2b83fa] transition-colors">
                                        <FiMinus className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manageCreditBalance}
                                        onChange={(event) => setManageCreditBalance(parseInt(event.target.value) || 0)}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-bold border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] text-center focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button type="button" onClick={() => setManageCreditBalance(prev => prev + 1)} className="w-10 h-10 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] flex items-center justify-center text-[#6e6e73] hover:text-[#2b83fa] transition-colors">
                                        <FiPlus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2">Free Credits Limit</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={manageFreeCreditsTotal}
                                    onChange={(event) => setManageFreeCreditsTotal(parseInt(event.target.value) || 0)}
                                    className="w-full px-4 py-2.5 rounded-xl text-[14px] font-bold border bg-[#f7f7f7] dark:bg-[#0d0e10] border-[#e0e0e0] dark:border-[#ffffff0a] text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-shadow"
                                />
                            </div>

                            <div>
                                <label className="block text-[12px] font-bold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <FiDownload className="w-3.5 h-3.5 text-[#2b83fa]" /> Transaction Report
                                </label>

                                {isLoadingReport ? (
                                    <div className="py-4 flex items-center gap-3">
                                        <FiRefreshCw className="w-4 h-4 text-[#2b83fa] animate-spin" />
                                        <p className="text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">History loading...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <div className="relative">
                                            <select
                                                value={reportSelectedMonth}
                                                onChange={(event) => setReportSelectedMonth(event.target.value)}
                                                className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e0e0e0] dark:border-[#ffffff0a] text-[13px] font-bold text-[#111111] dark:text-[#ececf1] focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all cursor-pointer"
                                            >
                                                <option value="All">All Transactions ({reportTransactions.length})</option>
                                                {Array.from(new Set(reportTransactions.map(tx => (tx.timestamp || tx.created_at || '').substring(0, 7)).filter(Boolean))).sort().reverse().map(month => {
                                                    const [year, monthNumber] = (month as string).split('-');
                                                    const label = new Date(parseInt(year), parseInt(monthNumber) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                                                    const count = reportTransactions.filter(tx => (tx.timestamp || tx.created_at || '').startsWith(month as string)).length;
                                                    return <option key={month as string} value={month as string}>{label} ({count})</option>;
                                                })}
                                            </select>
                                            <FiClock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9aa0a6] pointer-events-none w-3.5 h-3.5" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => generateMonthlyReport(reportSelectedMonth, reportTransactions, 'subaccount', getAccountName(managingAccount), managingAccount.agency_name)}
                                            disabled={reportTransactions.length === 0}
                                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white dark:bg-[#0d0e10] border-2 border-[#2b83fa]/20 hover:border-[#2b83fa] text-[#2b83fa] rounded-xl font-bold text-[13px] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                        >
                                            <FiDownload className="w-3.5 h-3.5" />
                                            Download {reportSelectedMonth === 'All' ? 'Full History' : 'Monthly Report'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading === 'managing'}
                                className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {actionLoading === 'managing' ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
                                Save Config
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {selectedReportAccount && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1b1e] border border-[#e5e5e5] dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white flex items-center gap-2">
                                    <FiDownload className="w-4 h-4 text-[#2b83fa]" /> Download Report
                                </h3>
                                <button onClick={() => setSelectedReportAccount(null)} className="p-1.5 text-[#6e6e73] hover:bg-[#f7f7f7] dark:hover:bg-white/5 rounded-full transition-colors">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-[13px] text-[#6e6e73] dark:text-[#9aa0a6]">
                                Select a month to download the credit report for <span className="font-semibold text-[#111111] dark:text-white">{getAccountName(selectedReportAccount)}</span>.
                            </p>

                            {isLoadingReport ? (
                                <div className="py-4 flex items-center justify-center gap-3 bg-[#f7f7f7] dark:bg-[#0d0e10] rounded-xl border border-[#e5e5e5] dark:border-white/5">
                                    <FiRefreshCw className="w-4 h-4 text-[#2b83fa] animate-spin" />
                                    <p className="text-[13px] font-medium text-[#111111] dark:text-white">Loading transactions...</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 pt-2">
                                    <select
                                        value={reportSelectedMonth}
                                        onChange={(event) => setReportSelectedMonth(event.target.value)}
                                        className="flex-1 appearance-none px-3 py-2 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] border border-[#e5e5e5] dark:border-white/5 text-[13px] font-bold text-[#111111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b83fa]/30 transition-all cursor-pointer"
                                    >
                                        <option value="All">Full History ({reportTransactions.length} events)</option>
                                        {Array.from(new Set(reportTransactions.map(tx => (tx.timestamp || tx.created_at || '').substring(0, 7)).filter(Boolean))).sort().reverse().map(month => {
                                            const [year, monthNumber] = (month as string).split('-');
                                            const label = new Date(parseInt(year), parseInt(monthNumber) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                                            const count = reportTransactions.filter(tx => (tx.timestamp || tx.created_at || '').startsWith(month as string)).length;
                                            return <option key={month as string} value={month as string}>{label} ({count})</option>;
                                        })}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => generateMonthlyReport(reportSelectedMonth, reportTransactions, 'subaccount', getAccountName(selectedReportAccount), selectedReportAccount.agency_name)}
                                        disabled={reportTransactions.length === 0}
                                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#2b83fa] to-[#1d6bd4] hover:shadow-[0_8px_25px_rgba(43,131,250,0.4)] text-white rounded-xl text-[13px] font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:hover:shadow-none whitespace-nowrap"
                                    >
                                        <FiDownload className="w-4 h-4" /> Download PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
