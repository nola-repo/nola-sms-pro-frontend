// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertCircle,
    FiClock,
    FiCreditCard,
    FiRefreshCw,
    FiSend,
    FiXCircle,
} from 'react-icons/fi';
import { adminFetch } from '../../utils/adminApi';
import { getAdminAuthHeaders } from '../../utils/adminAuthHeaders';

const POLL_INTERVAL = 15000;
const LOG_POLL_INTERVAL = 5000;
const ADMIN_LOGS_API = '/api/admin_sender_requests.php?action=logs';

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
    const [dbConnected, setDbConnected] = useState<boolean>(true);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(true);
    const [error, setError] = useState('');
    const [logsError, setLogsError] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [lastLogsRefreshed, setLastLogsRefreshed] = useState<Date>(new Date());

    const fetchHealth = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError('');

        try {
            const res = await adminFetch('/api/v2/admin_health', { headers: getAdminAuthHeaders() });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.status === 'success') {
                const healthData = json.data;
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

    const fetchLogs = useCallback(async (isInitial = false) => {
        if (isInitial) setLogsLoading(true);
        setLogsError('');

        try {
            const res = await adminFetch(ADMIN_LOGS_API, { headers: getAdminAuthHeaders() });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.status === 'success') {
                setLogs(Array.isArray(json.data) ? json.data : []);
            } else {
                setLogsError(json.message || 'Failed to load live system logs.');
            }
            setLastLogsRefreshed(new Date());
        } catch (e) {
            setLogsError('Network error. Could not refresh live system logs.');
        } finally {
            if (isInitial) setLogsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth(true);
        const timer = setInterval(() => fetchHealth(false), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchHealth]);

    useEffect(() => {
        fetchLogs(true);
        const timer = setInterval(() => fetchLogs(false), LOG_POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchLogs]);



    const systemStatus = useMemo(() => {
        if (!dbConnected) return { label: 'System Offline', style: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400', dot: 'bg-red-500' };
        if ((stats?.failed_messages ?? 0) >= 10) return { label: 'Attention Needed (Failed Sends)', style: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400', dot: 'bg-red-500' };
        if (stats?.delivery_rate !== undefined && stats.delivery_rate < 85) return { label: 'Degraded Performance (Low Success Rate)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        if ((stats?.low_balance_subaccounts ?? 0) > 0) return { label: 'Attention Needed (Low Credits)', style: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        return { label: 'All Systems Operational', style: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    }, [dbConnected, stats]);

    const healthCards = [
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

    const logRows = useMemo(() => {
        const timestampOf = (log: any): string => (
            log.timestamp
            || log.date_created
            || log.created_at
            || log.updated_at
            || ''
        );

        const statusOf = (log: any): string => String(log.status || log.delivery_status || '').toLowerCase();
        const typeOf = (log: any): string => {
            if (log.type === 'message' && (log.amount === undefined || log.amount === null)) return 'SMS';
            const amount = log.amount;
            const isNegative = (typeof amount === 'number' && amount < 0) || (typeof amount === 'string' && amount.startsWith('-'));
            if (isNegative || log.type === 'deduction' || log.type === 'credit_usage' || amount === 0) return 'Credits Used';
            if (amount !== undefined || log.type === 'top_up' || log.type === 'credit_purchase') return 'Credits Added';
            if (log.type === 'sender_request') return 'Sender Request';
            return log.type ? String(log.type).replace(/_/g, ' ') : 'System';
        };

        const severityOf = (log: any): 'INFO' | 'WARN' | 'ERROR' => {
            const status = statusOf(log);
            if (['failed', 'rejected', 'revoked', 'error', 'denied'].includes(status)) return 'ERROR';
            if (['pending', 'queued', 'processing', 'requested'].includes(status)) return 'WARN';
            return 'INFO';
        };

        const summaryOf = (log: any): string => {
            const type = typeOf(log);
            const status = statusOf(log) || 'recorded';
            const loc = log.location_id || log.account_id || 'system';

            if (type === 'SMS') {
                const target = log.number || log.to || 'unknown recipient';
                const body = String(log.message || 'No message content').replace(/\s+/g, ' ').trim();
                return `SMS ${status} to ${target} | ${body}`;
            }

            if (type === 'Sender Request') {
                return `Sender request ${status} | ${log.requested_id || log.sender_id || log.sendername || 'unknown sender'} | ${loc}`;
            }

            if (type === 'Credits Added' || type === 'Credits Used') {
                const amount = log.amount ?? 0;
                const balance = log.balance_after !== undefined ? ` | balance=${log.balance_after}` : '';
                return `${type} amount=${amount}${balance} | ${loc}`;
            }

            return `${type} ${status} | ${loc}`;
        };

        return [...logs]
            .sort((a, b) => String(timestampOf(b)).localeCompare(String(timestampOf(a))))
            .slice(0, 12)
            .map((log, index) => {
                const rawTime = timestampOf(log);
                const parsed = rawTime ? new Date(rawTime) : null;
                return {
                    id: log.id || `${rawTime}-${index}`,
                    severity: severityOf(log),
                    time: parsed && !Number.isNaN(parsed.getTime())
                        ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Just now',
                    type: typeOf(log),
                    summary: summaryOf(log),
                };
            });
    }, [logs]);

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

            <section className="rounded-2xl border border-[#e5e5e5] bg-white shadow-sm dark:border-white/5 dark:bg-[#1a1b1e]">
                <div className="flex flex-col gap-3 border-b border-[#e5e5e5] px-5 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111111] dark:text-white">
                            <FiActivity className="h-4 w-4 text-[#2b83fa]" />
                            Live System Logs
                        </h3>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-[#6e6e73] dark:text-[#9aa0a6]">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                            Updates every 5 seconds
                            <span className="text-[#d0d0d0] dark:text-white/20">/</span>
                            <FiClock className="h-3 w-3" />
                            {lastLogsRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                    <button
                        onClick={() => fetchLogs(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3.5 py-2 text-[12px] font-bold text-[#6e6e73] transition-all hover:text-[#2b83fa] dark:border-white/5 dark:bg-[#0d0e10] dark:text-[#9aa0a6] dark:hover:text-white"
                    >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {logsError && (
                    <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 dark:border-red-900/20 dark:bg-red-900/10 dark:text-red-400">
                        <FiAlertCircle className="h-4 w-4" />
                        {logsError}
                    </div>
                )}

                <div className="divide-y divide-[#e5e5e5] dark:divide-white/5">
                    {logsLoading && logRows.length === 0 ? (
                        <div className="space-y-2 p-5">
                            {[...Array(5)].map((_, index) => (
                                <div key={index} className="h-12 rounded-xl bg-[#f7f7f7] dark:bg-[#0d0e10] animate-pulse" />
                            ))}
                        </div>
                    ) : logRows.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <FiActivity className="mx-auto mb-3 h-8 w-8 text-[#d0d0d0] dark:text-white/20" />
                            <p className="text-[13px] font-bold text-[#111111] dark:text-white">No live logs yet</p>
                            <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#9aa0a6]">Recent platform activity will appear here automatically.</p>
                        </div>
                    ) : logRows.map((row) => (
                        <div key={row.id} className="grid gap-3 px-5 py-3 sm:grid-cols-[84px_116px_120px_1fr] sm:items-center">
                            <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-black ${row.severity === 'ERROR' ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400' : row.severity === 'WARN' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400' : 'border-blue-200 bg-blue-50 text-[#2b83fa] dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400'}`}>
                                {row.severity}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[#6e6e73] dark:text-[#9aa0a6]">{row.time}</span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#111111] dark:text-white">{row.type}</span>
                            <span className="min-w-0 truncate text-[12px] font-medium text-[#6e6e73] dark:text-[#9aa0a6]" title={row.summary}>{row.summary}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
