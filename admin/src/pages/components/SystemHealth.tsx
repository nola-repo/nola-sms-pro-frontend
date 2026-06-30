// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiAlertCircle,
    FiCreditCard,
    FiDatabase,
    FiRefreshCw,
    FiSend,
    FiXCircle,
} from 'react-icons/fi';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const POLL_INTERVAL = 15000;

const healthTone = (state: 'ok' | 'warn' | 'bad') => {
    if (state === 'ok') return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-emerald-500/20 dark:hover:border-emerald-500/30';
    if (state === 'warn') return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-amber-500/20 dark:hover:border-amber-500/30';
    return 'border-[#e5e5e5] dark:border-white/5 bg-white dark:bg-[#1a1b1e] hover:border-red-500/20 dark:hover:border-red-500/30';
};

const iconTone = (state: 'ok' | 'warn' | 'bad') => {
    if (state === 'ok') return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10';
    if (state === 'warn') return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10';
    return 'text-red-500 bg-red-50 dark:bg-red-500/10';
};


export const SystemHealth: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [dbConnected, setDbConnected] = useState<boolean>(true);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchHealth = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError('');

        try {
            const res = await adminFetch('/api/v2/admin_health', { headers: getAdminAuthHeaders() });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.status === 'success') {
                const healthData = json.data;
                setAccounts(healthData.accounts || []);
                setDbConnected(healthData.database_connected !== false);
                setStats(healthData.stats || null);
            } else {
                setError(json.message || 'Failed to fetch system health diagnostics.');
            }
            setLastRefreshed(new Date());
        } catch (e) {
            setError('Network error. Could not refresh system health.');
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth(true);
        const timer = setInterval(() => fetchHealth(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchHealth]);



    const systemStatus = useMemo(() => {
        if (!dbConnected) return { label: 'System Offline', style: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400', dot: 'bg-red-500' };
        if ((stats?.failed_messages ?? 0) >= 10) return { label: 'Attention Needed (Failed Sends)', style: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400', dot: 'bg-red-500' };
        if (stats?.delivery_rate !== undefined && stats.delivery_rate < 85) return { label: 'Degraded Performance (Low Success Rate)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        if ((stats?.low_balance_subaccounts ?? 0) > 0) return { label: 'Attention Needed (Low Credits)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        return { label: 'All Systems Operational', style: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    }, [dbConnected, stats]);

    const healthCards = [
        {
            label: 'Database Integrity',
            value: dbConnected ? 'Online' : 'Offline',
            detail: dbConnected ? 'Core Firestore operational' : 'Database connection error',
            icon: <FiDatabase />,
            state: dbConnected ? 'ok' : 'bad',
        },
        {
            label: 'SMS Success Rate',
            value: `${stats?.delivery_rate ?? 100}%`,
            detail: `${stats?.sent_messages ?? 0} sent of ${stats?.total_messages ?? 0} messages`,
            icon: <FiSend />,
            state: (stats?.delivery_rate ?? 100) >= 95 ? 'ok' : (stats?.delivery_rate ?? 100) >= 80 ? 'warn' : 'bad',
        },
        {
            label: 'Failed Sends',
            value: (stats?.failed_messages ?? 0).toLocaleString(),
            detail: 'Failed messages in window',
            icon: <FiXCircle />,
            state: (stats?.failed_messages ?? 0) === 0 ? 'ok' : (stats?.failed_messages ?? 0) < 10 ? 'warn' : 'bad',
        },
        {
            label: 'Billing Health',
            value: stats?.low_balance_subaccounts ? `${stats.low_balance_subaccounts} low` : 'Healthy',
            detail: `${stats?.total_subaccounts ?? 0} subaccounts monitored`,
            icon: <FiCreditCard />,
            state: (stats?.low_balance_subaccounts ?? 0) === 0 ? 'ok' : (stats?.low_balance_subaccounts ?? 0) < 5 ? 'warn' : 'bad',
        },
    ];


    const lowBalanceAccounts = useMemo(() => (
        accounts
            .map((account) => {
                const data = account.data ? { id: account.id, ...account.data } : account;
                const balance = Number(data.balance ?? data.credit_balance ?? data.credits ?? 0);
                return {
                    id: data.location_id || data.active_location_id || data.id || account.id || 'unknown',
                    name: data.location_name || data.name || data.company_name || data.email || 'Unnamed account',
                    balance: Number.isFinite(balance) ? balance : 0,
                };
            })
            .filter((account) => account.balance <= 50)
            .sort((a, b) => a.balance - b.balance)
            .slice(0, 8)
    ), [accounts]);

    return (
        <div className="space-y-5 text-[#111111] dark:text-white">
            {/* Header section with real-time health indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-white dark:bg-[#1a1b1e] border-[#e5e5e5] dark:border-white/5 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-3">
                    <div className={`relative flex h-3 w-3`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatus.dot}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.dot}`}></span>
                    </div>
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight">{systemStatus.label}</h2>
                        <p className="text-[11px] text-[#6e6e73] dark:text-[#9aa0a6] mt-0.5 font-medium">
                            Last checked: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchHealth(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-[12px] font-bold text-[#6e6e73] shadow-sm transition-all hover:bg-[#f7f7f7] hover:text-[#111111] dark:border-white/10 dark:bg-[#1a1b1e] dark:text-[#9aa0a6] dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Run Health Check
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/70 dark:border-red-900/20 dark:bg-red-900/10 px-4 py-3 text-[12px] font-semibold text-red-600 dark:text-red-400">
                    <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Health Metric Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {healthCards.map((card) => (
                    <div key={card.label} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all duration-300 ${healthTone(card.state)}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] dark:text-[#9aa0a6]">{card.label}</div>
                                <div className="text-[26px] font-extrabold tracking-tight text-[#111111] dark:text-white">{card.value}</div>
                                <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#9aa0a6] leading-relaxed">{card.detail}</div>
                            </div>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm text-[20px] border border-black/5 dark:border-white/5 ${iconTone(card.state)}`}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111111] dark:text-white">
                    <FiCreditCard className="h-4 w-4 text-[#2b83fa]" />
                    Low Credit Watch
                </h3>
                <div className="mt-4 space-y-2">
                    {lowBalanceAccounts.length === 0 ? (
                        <div className="rounded-xl border border-emerald-100/50 bg-emerald-50/30 px-4 py-5 text-center text-[12px] font-bold text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/[0.03] dark:text-emerald-400">
                            No accounts are at or below 50 credits.
                        </div>
                    ) : lowBalanceAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 dark:border-white/5 dark:bg-[#0d0e10]">
                            <div className="min-w-0">
                                <div className="truncate text-[12px] font-bold text-[#111111] dark:text-white" title={account.name}>{account.name}</div>
                                <div className="truncate font-mono text-[9.5px] text-[#9aa0a6]" title={account.id}>{account.id}</div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${account.balance <= 0 ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400'}`}>
                                {account.balance.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
