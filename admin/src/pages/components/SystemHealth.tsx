// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertCircle,
    FiChevronDown,
    FiClock,
    FiCreditCard,
    FiDatabase,
    FiRefreshCw,
    FiSearch,
    FiSend,
    FiTerminal,
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

    const logRows = useMemo(() => {
        const stamp = (offsetSeconds: number) => new Date(lastRefreshed.getTime() - offsetSeconds * 1000).toISOString().replace('T', ' ').slice(0, 23);
        const rows = [
            {
                severity: dbConnected ? 'INFO' : 'ERROR',
                time: stamp(0),
                summary: `GET /api/v2/admin_health status=${dbConnected ? 200 : 503} database_connected=${dbConnected}`,
            },
            {
                severity: (stats?.failed_messages ?? 0) > 0 ? 'WARN' : 'INFO',
                time: stamp(3),
                summary: `SMS delivery window total=${stats?.total_messages ?? 0} sent=${stats?.sent_messages ?? 0} failed=${stats?.failed_messages ?? 0} success_rate=${stats?.delivery_rate ?? 100}%`,
            },
            {
                severity: (stats?.low_balance_subaccounts ?? 0) > 0 ? 'WARN' : 'INFO',
                time: stamp(7),
                summary: `Billing monitor low_credit_subaccounts=${stats?.low_balance_subaccounts ?? 0} total_subaccounts=${stats?.total_subaccounts ?? 0}`,
            },
            {
                severity: 'INFO',
                time: stamp(12),
                summary: `Low Credit Watch evaluated accounts=${accounts.length} threshold=50`,
            },
        ];

        lowBalanceAccounts.slice(0, 4).forEach((account, index) => {
            rows.push({
                severity: account.balance <= 0 ? 'ERROR' : 'WARN',
                time: stamp(18 + index * 2),
                summary: `credit_watch location=${account.id} name="${account.name}" balance=${account.balance}`,
            });
        });

        return rows;
    }, [accounts.length, dbConnected, lastRefreshed, lowBalanceAccounts, stats]);

    const timelineBars = useMemo(() => Array.from({ length: 72 }, (_, index) => {
        const base = ((index * 17) % 42) + 8;
        const spike = index % 13 === 0 ? 22 : 0;
        const warn = index % 19 === 0;
        return { height: Math.min(base + spike, 72), warn };
    }), []);

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

            <section className="overflow-hidden rounded-lg border border-[#30343b] bg-[#111315] shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#2b2f36] bg-[#15171a] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <FiTerminal className="h-4 w-4 text-[#8ab4f8]" />
                        <h3 className="text-[14px] font-bold">Logs Explorer</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#9aa0a6]">
                        <button className="inline-flex items-center gap-1 rounded border border-[#3c4043] px-2.5 py-1 text-[#cbd5e1] hover:bg-white/5">
                            <FiClock className="h-3.5 w-3.5 text-[#8ab4f8]" />
                            Last 5 minutes
                            <FiChevronDown className="h-3 w-3" />
                        </button>
                        <button onClick={() => fetchHealth(true)} className="rounded bg-[#8ab4f8] px-3 py-1.5 text-[#07111f] transition hover:bg-[#a8c7fa]">
                            Run query
                        </button>
                    </div>
                </div>

                <div className="border-b border-[#2b2f36] bg-[#202124] px-4 py-2">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <button className="inline-flex w-fit items-center gap-1 rounded border border-[#3c4043] bg-[#17191c] px-3 py-1.5 text-[11px] font-bold text-[#e8eaed]">
                            <FiActivity className="h-3.5 w-3.5" />
                            Project logs
                            <FiChevronDown className="h-3 w-3" />
                        </button>
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-[#30343b] bg-[#17191c] px-3 py-1.5 text-[#9aa0a6]">
                            <FiSearch className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate text-[11px] font-semibold">Search all fields</span>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {['All resources', 'All log names', 'All severities', 'Correlate by'].map((filter) => (
                            <button key={filter} className="inline-flex items-center gap-1 rounded border border-[#3c4043] bg-[#17191c] px-2.5 py-1 text-[10px] font-bold text-[#cbd5e1]">
                                {filter}
                                <FiChevronDown className="h-3 w-3" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-b border-[#2b2f36] bg-black px-4 py-3 font-mono text-[11px] text-[#d2e3fc]">
                    <div className="flex gap-3">
                        <span className="select-none text-[#8ab4f8]">1</span>
                        <span className="italic">resource.type="cloud_run_revision" severity&gt;=DEFAULT</span>
                    </div>
                </div>

                <div className="border-b border-[#2b2f36] bg-[#15171a] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#cbd5e1]">
                        <span>Timeline</span>
                        <span className="font-mono text-[#8ab4f8]">{logRows.length.toLocaleString()} results</span>
                    </div>
                    <div className="flex h-16 items-end gap-1 border-b border-[#5f6368] px-1">
                        {timelineBars.map((bar, index) => (
                            <span
                                key={index}
                                className={`flex-1 min-w-[3px] rounded-t-sm ${bar.warn ? 'bg-[#f28b82]' : 'bg-[#8ab4f8]'}`}
                                style={{ height: `${bar.height}%` }}
                            />
                        ))}
                    </div>
                </div>

                <div className="max-h-[320px] overflow-auto bg-[#111315]">
                    <div className="grid min-w-[760px] grid-cols-[72px_176px_1fr] border-b border-[#30343b] bg-[#202124] px-4 py-2 text-[10px] font-black uppercase tracking-wide text-[#9aa0a6]">
                        <span>Severity</span>
                        <span>Time</span>
                        <span>Summary</span>
                    </div>
                    {logRows.map((row, index) => (
                        <div key={`${row.time}-${index}`} className="grid min-w-[760px] grid-cols-[72px_176px_1fr] items-center border-b border-[#282c32] px-4 py-2 font-mono text-[11px] text-[#e8eaed] hover:bg-[#1b1f24]">
                            <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${row.severity === 'ERROR' ? 'bg-[#f28b82]' : row.severity === 'WARN' ? 'bg-[#fdd663]' : 'bg-[#8ab4f8]'}`} />
                                <span className="text-[#9aa0a6]">{row.severity}</span>
                            </span>
                            <span className="text-[#d2e3fc]">{row.time}</span>
                            <span className="truncate" title={row.summary}>{row.summary}</span>
                        </div>
                    ))}
                </div>
            </section>

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
